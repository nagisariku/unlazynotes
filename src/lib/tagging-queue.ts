import { generateNoteTags } from '@/lib/ai';
import { db } from '@/db';
import { notes, type NoteCategory } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface TaggingTask {
  noteId: string;
  content: string;
  tier: 'free' | 'pro';
  createdAt: number;
  onComplete?: (result: { category: string; specificTags: string[] }) => void;
  onError?: (error: unknown) => void;
}

class TaggingQueueManager {
  private fastLane: TaggingTask[] = []; // Pro Tier (Prioritas Tinggi)
  private standardLane: TaggingTask[] = []; // Free Tier (Standard)
  private activeWorkers = 0;
  private readonly maxConcurrency = 3;

  /**
   * Menambahkan tugas tagging ke antrean:
   * - Pro Tier masuk ke Fast-Lane (diproses prioritas pertama).
   * - Free Tier masuk ke Standard-Lane.
   */
  public enqueue(task: Omit<TaggingTask, 'createdAt'>): void {
    const fullTask: TaggingTask = {
      ...task,
      createdAt: Date.now(),
    };

    if (task.tier === 'pro') {
      this.fastLane.push(fullTask);
    } else {
      this.standardLane.push(fullTask);
    }

    this.processNext();
  }

  /**
   * Mengambil tugas berikutnya dengan prioritas Fast-Lane Pro diutamakan.
   */
  private getNextTask(): TaggingTask | undefined {
    if (this.fastLane.length > 0) {
      return this.fastLane.shift();
    }
    return this.standardLane.shift();
  }

  private async processNext(): Promise<void> {
    if (this.activeWorkers >= this.maxConcurrency) {
      return;
    }

    const task = this.getNextTask();
    if (!task) {
      return;
    }

    this.activeWorkers++;

    (async () => {
      try {
        const tagResult = await generateNoteTags(task.content);
        const validCategory: NoteCategory = (tagResult.category as NoteCategory) || 'others';

        await db
          .update(notes)
          .set({
            category: validCategory,
            specificTags: tagResult.specific_tags || [],
            source: tagResult.source || 'telegram',
          })
          .where(eq(notes.id, task.noteId));

        if (task.onComplete) {
          task.onComplete({
            category: validCategory,
            specificTags: tagResult.specific_tags || [],
          });
        }
      } catch (err) {
        console.error(`[TaggingQueue] Error processing note ${task.noteId} (Tier: ${task.tier}):`, err);
        if (task.onError) {
          task.onError(err);
        }
      } finally {
        this.activeWorkers--;
        // Lanjutkan memproses antrean berikutnya
        this.processNext();
      }
    })();
  }

  public getStatus() {
    return {
      fastLaneCount: this.fastLane.length,
      standardLaneCount: this.standardLane.length,
      activeWorkers: this.activeWorkers,
      totalPending: this.fastLane.length + this.standardLane.length,
    };
  }
}

export const taggingQueue = new TaggingQueueManager();

import { db } from '../src/db';
import { notes, users } from '../src/db/schema';
import { encryptSecret } from '../src/lib/crypto';
import { eq, and } from 'drizzle-orm';

interface DummyCred {
  idSuffix: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  minutesAgo: number;
}

const DUMMY_CREDENTIALS: DummyCred[] = [
  {
    idSuffix: 'wifi_01',
    content: `Wi-Fi Utama Kantor (Lantai 2):
SSID: UnlazyOffice-5G
Password: CoffeeAndCode#2026
IP Gateway: 192.168.1.1
DNS: 1.1.1.1, 8.8.8.8`,
    tags: ['wifi', 'kantor'],
    isPinned: true,
    minutesAgo: 60,
  },
  {
    idSuffix: 'wifi_02',
    content: `Akses Wi-Fi Hub Coworking Space:
SSID: NomadWorkspace_VIP
Pass: digitalnomad99!
Valid sampai akhir kuartal Q4 2026. Kecepatan 150 Mbps dedicated.`,
    tags: ['wifi', 'coworking'],
    isPinned: false,
    minutesAgo: 180,
  },
  {
    idSuffix: 'srv_01',
    content: `Server Production Bastion Host:
Host: bastion.prod.unlazynotes.internal
Port: 4422
User: riku_admin
Tunnel command: ssh -D 1080 -N -p 4422 riku_admin@bastion.prod`,
    tags: ['server', 'production'],
    isPinned: true,
    minutesAgo: 240,
  },
  {
    idSuffix: 'srv_02',
    content: `SSH Server Staging Singapore:
Host: sg-stage.unlazynotes.com
Port: 2222
User: deployer
Auth: ~/.ssh/id_ed25519_staging
Passphrase key: stg-unlazy-sg-2026`,
    tags: ['server', 'staging'],
    isPinned: false,
    minutesAgo: 360,
  },
  {
    idSuffix: 'db_01',
    content: `PostgreSQL Read-Only Analytics Replica:
Host: ro-db.ap-southeast-1.rds.amazonaws.com
Port: 5432
Database: analytics_prod
User: ro_riku
Password: RoSecure$Pass987
SSL Mode: require`,
    tags: ['database', 'analytics'],
    isPinned: false,
    minutesAgo: 480,
  },
  {
    idSuffix: 'db_02',
    content: `Redis Cache Cluster VPC:
Endpoint: redis-cluster.internal:6379
Auth: unlz_redis_auth_token_99x
Max Memory Policy: volatile-lru
DB Index: 0 (session), 1 (queue)`,
    tags: ['database', 'redis'],
    isPinned: false,
    minutesAgo: 600,
  },
  {
    idSuffix: 'acc_01',
    content: `Akun Shared Figma Organization:
Email: design-team@unlazynotes.com
Password: FigmaCraft#Tokens2026
2FA: Cek 1Password shared team vault untuk token TOTP.`,
    tags: ['akun', 'design'],
    isPinned: false,
    minutesAgo: 720,
  },
  {
    idSuffix: 'acc_02',
    content: `Twitter / X Bot Developer Account:
Handle: @unlazynotes_bot
Email login: dev-social@unlazynotes.com
Recovery Phone: +62812****890
Client ID: 890123456789`,
    tags: ['akun', 'social'],
    isPinned: false,
    minutesAgo: 840,
  },
  {
    idSuffix: 'vpn_01',
    content: `WireGuard Internal VPN Profile:
Endpoint: vpn.unlazynotes.internal:51820
Address: 10.8.0.45/24
DNS: 10.8.0.1
AllowedIPs: 10.8.0.0/16, 172.20.0.0/16`,
    tags: ['vpn', 'internal'],
    isPinned: false,
    minutesAgo: 960,
  },
  {
    idSuffix: 'dns_01',
    content: `Cloudflare DNS Management Access:
Domain: unlazynotes.com
Account ID: cfc_8981290312aa
Nameservers: dora.ns.cloudflare.com, paul.ns.cloudflare.com
API Token Scope: Zone.DNS:Edit`,
    tags: ['domain', 'dns'],
    isPinned: false,
    minutesAgo: 1080,
  },
];

async function seedCredentials() {
  console.log('Seeding dummy credential notes...');

  // Target admin user only
  const allUsers = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.role, 'admin'));
  console.log(`Found ${allUsers.length} admin user(s) in database:`, allUsers.map((u) => `${u.name} (${u.id})`));

  for (const user of allUsers) {
    console.log(`\nProcessing user: ${user.name} (${user.id})...`);

    for (const cred of DUMMY_CREDENTIALS) {
      const noteId = `cred_dummy_${user.id.slice(-4)}_${cred.idSuffix}`;
      const createdAt = new Date(Date.now() - cred.minutesAgo * 60 * 1000);
      const encryptedContent = encryptSecret(cred.content, user.id);

      // Check if already exists
      const [existing] = await db
        .select({ id: notes.id })
        .from(notes)
        .where(and(eq(notes.id, noteId), eq(notes.userId, user.id)))
        .limit(1);

      if (existing) {
        await db
          .update(notes)
          .set({
            content: encryptedContent,
            category: 'credential',
            specificTags: cred.tags,
            vaultKey: null,
            isEncrypted: true,
            isPinned: cred.isPinned,
          })
          .where(eq(notes.id, noteId));
        console.log(`  Updated note: ${noteId}`);
      } else {
        await db.insert(notes).values({
          id: noteId,
          userId: user.id,
          content: encryptedContent,
          category: 'credential',
          specificTags: cred.tags,
          vaultKey: null,
          isEncrypted: true,
          isPinned: cred.isPinned,
          source: 'web',
          createdAt,
        });
        console.log(`  Inserted note: ${noteId}`);
      }
    }
  }

  console.log('\nSeeding dummy credentials completed successfully!');
  process.exit(0);
}

seedCredentials().catch((err) => {
  console.error('Failed to seed credentials:', err);
  process.exit(1);
});

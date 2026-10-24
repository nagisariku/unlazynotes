import { Toaster } from 'sonner';

export default function GlobalToaster() {
  return (
    <Toaster
      position="top-center"
      duration={4000}
      toastOptions={{
        className: 'rounded-xl border border-hairline bg-canvas text-ink shadow-none font-sans font-normal text-body-sm py-3 px-4',
      }}
    />
  );
}

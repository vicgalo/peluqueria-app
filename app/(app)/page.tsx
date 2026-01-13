export default function HomePage() {
    return (
      <main className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <img
            src="/icon-192.png"
            alt="Logo"
            className="mx-auto h-28 w-28 rounded-3xl shadow"
          />
          <div>
            <h1 className="text-2xl font-semibold">Peluquería</h1>
            <p className="text-zinc-500">Gestión rápida y sencilla</p>
          </div>
        </div>
      </main>
    );
  }
  
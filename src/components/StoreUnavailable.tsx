/**
 * Lo que ve un cliente cuando la tienda de un negocio suspendido: un aviso neutro en vez de un 404,
 * que daría a entender que la tienda dejó de existir. Nunca dice el motivo.
 */
export default function StoreUnavailable({ name }: { name: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "#F5F3EF" }}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 border border-black/5 shadow-sm text-center space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">{name}</p>
        <h1 className="text-xl font-semibold text-neutral-900">Tienda no disponible por ahora</h1>
        <p className="text-sm leading-relaxed text-neutral-600">
          Esta tienda no está recibiendo pedidos en línea en este momento. Volvé a intentar más tarde.
        </p>
      </div>
    </main>
  );
}

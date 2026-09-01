import { IneReader } from "@/components/IneReader";
import { listRegistros } from "@/lib/csv";

export const dynamic = "force-dynamic";

export default async function Home() {
  const registros = await listRegistros().catch(() => []);

  return (
    <main className="min-h-full">
      <IneReader initialRegistros={registros} />
    </main>
  );
}

import { Workbench } from "@/components/workbench";

export const dynamic = "force-dynamic";

export default function Home() {
  const generatedAt = new Date().toISOString();
  return (
    <Workbench
      initialAsOf={generatedAt.slice(0, 10)}
      initialGeneratedAt={generatedAt}
    />
  );
}

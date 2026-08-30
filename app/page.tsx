import { Workbench } from "@/components/workbench";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Workbench initialAsOf={new Date().toISOString().slice(0, 10)} />;
}

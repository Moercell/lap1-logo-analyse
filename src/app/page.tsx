import Image from "next/image";

import { LogAnalyser } from "@/components/log-analyser";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="page-brand no-print">
        <Image alt="infrest Logo" height={42} priority src="/infrest-logo.svg" width={220} />
      </section>
      <section className="hero no-print">
        <div className="hero-brand">
          <p className="eyebrow">LAP1 Process Observatory</p>
        </div>
        <h1>LAP1 Log Analyse</h1>
        <p className="hero-copy">
          Upload, Auswertung und druckfähige Reports für PdbWizard-Prozesse auf User- und Vorgangsebene.
        </p>
      </section>
      <LogAnalyser />
    </main>
  );
}

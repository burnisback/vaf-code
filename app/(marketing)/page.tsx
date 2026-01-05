import {
  Hero,
  TrustStrip,
  SocialProof,
  WorkflowTimeline,
  ArtifactPreview,
  PricingTable,
  QualityGates,
  FAQ,
  FinalCTA,
} from "@/components/landing/sections";

export default function Home() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <SocialProof />
      <WorkflowTimeline />
      <ArtifactPreview />
      <QualityGates />
      <PricingTable />
      <FAQ />
      <FinalCTA />
    </>
  );
}

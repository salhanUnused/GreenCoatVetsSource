import { PawCircularLoader } from "@/components/web/paw-circular-loader";

export default function VisitDetailLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-[#d8e0ea] px-4 py-16">
      <PawCircularLoader size="md" message="Opening visit…" />
    </div>
  );
}

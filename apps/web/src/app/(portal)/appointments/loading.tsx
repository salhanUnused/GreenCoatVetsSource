import { PawCircularLoader } from "@/components/web/paw-circular-loader";

export default function AppointmentsLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-[#d8e0ea] px-4 py-12">
      <PawCircularLoader size="md" message="Loading appointments…" />
    </div>
  );
}

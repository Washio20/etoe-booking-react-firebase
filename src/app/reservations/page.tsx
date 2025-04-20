import AmenityPurchaseHistory from "@/components/AmenityPurchaseHistory";
import ReservationList from "@/components/ReservationList";
import Layout from "@/components/Layout";

export default function ReservationsPage() {
  return (
    <Layout>
      <div className="w-full max-w-[920px] mx-auto px-4 md:px-0 py-6 md:py-12">
        <div className="space-y-16 md:space-y-24">
          <ReservationList />
          {/* <AmenityPurchaseHistory /> */}
        </div>
      </div>
    </Layout>
  );
}

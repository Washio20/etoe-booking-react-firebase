import RoomSelection from "@/components/RoomSelection";
import Layout from "@/components/Layout";

export default function Home() {
  return (
    <Layout>
      <div className="max-w-[980px] mx-auto px-4 md:px-0 py-4 md:py-8 space-y-12">
        <RoomSelection />
      </div>
    </Layout>
  );
}

import Register from "@/components/Register";
import Layout from "@/components/Layout";

export default function RegisterPage() {
  return (
    <Layout>
      <div className="max-w-[920px] mx-auto py-8 md:py-12 px-4 md:px-0">
        <Register />
      </div>
    </Layout>
  );
}

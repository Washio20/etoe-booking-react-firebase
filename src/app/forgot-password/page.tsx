import ForgotPassword from "@/components/ForgotPassword";
import Layout from "@/components/Layout";

export default function ForgotPasswordPage() {
  return (
    <Layout>
      <div className="max-w-[920px] mx-auto py-8 md:py-12 px-4 md:px-0">
        <ForgotPassword />
      </div>
    </Layout>
  );
}

import ContactForm from "@/components/ContactForm";
import Layout from "@/components/Layout";

export default function ContactPage() {
  return (
    <Layout>
      <div className="max-w-[920px] mx-auto py-6 md:py-12">
        <ContactForm />
      </div>
    </Layout>
  );
}

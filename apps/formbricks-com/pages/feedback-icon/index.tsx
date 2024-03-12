import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";

export default function FeedbackBoxPage() {
  return (
    <Layout title="Feedback Icon" description="Feedback Icon Collection: Direct Download">
      <HeroTitle headingPt1="" headingTeal="Feedback Icon" subheading="Directly download feedback icons" />
      <div className="flex flex-wrap items-center space-x-4 space-y-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(() => (
          <div
            className="h-40 w-40 cursor-pointer rounded-md border border-slate-300 bg-slate-200 p-6 
        transition-transform duration-150 hover:scale-110 dark:border-slate-500 dark:bg-slate-700"></div>
        ))}
      </div>
    </Layout>
  );
}

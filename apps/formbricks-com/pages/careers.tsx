import HeroTitle from "@/components/shared/HeroTitle";
import Layout from "@/components/shared/Layout";
import Link from "next/link";

const Roles = [
  {
    name: "(Senior) Full-Stack Engineer",
    description: "Join early and be a part of our journey right from the start 🚀",
    location: "Worldwide",
    workplace: "Remote",
  } /*
  {
    name: "Junior Full-Stack Engineer",
    description: "All you want is write code and learn? You're exactly right!",
    location: "Worldwide",
    workplace: "Remote",
  },*/,
];

export default function CareersPage() {
  return (
    <Layout
      title="Careers"
      description="Work with us on helping teams make truly customer-centric decisions - all privacy-focused.">
      <HeroTitle
        headingPt1="Life is too short for"
        headingTeal="mediocre products."
        headingPt2=""
        subheading="Empower teams to build exactly what their users need."
      />

      <div className="mx-auto w-3/4">
        {Roles.map((role) => (
          <Link
            href="https://formbricks.notion.site/Work-at-Formbricks-6c3ad218b2c7461ca2714ce2101730e4?pvs=4"
            target="_blank"
            key="role.name">
            <div className="mb-6 rounded-lg border border-slate-300 bg-slate-100 p-6 shadow-sm hover:bg-slate-50">
              <h4 className="text-xl font-bold text-slate-700">{role.name}</h4>
              <p className="text-lg text-slate-500">{role.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </Layout>
  );
}

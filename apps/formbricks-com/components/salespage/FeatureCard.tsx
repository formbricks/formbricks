interface TestimonialProps {
  title: string;
  text: string;
  Icon: React.ElementType;
}

export default function SalesTestimonial({ title, text, Icon }: TestimonialProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-gradient-to-tr from-slate-100 to-slate-100 p-4 transition-colors delay-1000 duration-1000 ease-in-out hover:to-slate-50">
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <Icon className="h-12 w-12 text-slate-500" strokeWidth={1} />
      </div>
      <div>
        <h3 className="text-pretty text-lg font-medium text-slate-800">{title}</h3>
        <p className="text-slate-500">{text}</p>
      </div>
    </div>
  );
}

export default function MessagePage({ text }) {
  return (
    <div className="min-h-screen bg-white px-4 py-16 sm:px-6 sm:py-24 md:grid md:place-items-center lg:px-8">
      <div className="mx-auto max-w-max">
        <main>
          <div className="text-ui-gray-dark flex justify-center text-sm">{text}</div>
        </main>
      </div>
    </div>
  );
}

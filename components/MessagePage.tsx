export default function MessagePage({ text }) {
  return (
    <div className="min-h-screen px-4 py-16 bg-white sm:px-6 sm:py-24 md:grid md:place-items-center lg:px-8">
      <div className="mx-auto max-w-max">
        <main>
          <div className="flex justify-center text-sm text-ui-gray-dark">
            {text}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function OptionButton ({ active, icon, onClick }) {
    return (
      <div
        className={`${
          active ? "bg-slate-200 rounded-full" : ""
        } cursor-pointer`}
        onClick={onClick}
      >
        {icon}
      </div>
    );
  };
  
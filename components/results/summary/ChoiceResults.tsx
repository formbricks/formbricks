import "chart.js/auto";
import { Chart } from "react-chartjs-2";
import BaseResults from "./BaseResults";

export default function ChoiceResults({ element }) {
  const data = {
    //labels: element.data.options,
    labels: element.options.map((o) => o.label),
    datasets: [
      {
        //data: getDataset(element, elementAnswers),
        data: element.options.map((o) => o.summary || 0),
        backgroundColor: ["rgba(245, 59, 87, 0.7)"],
        borderColor: ["rgba(245, 59, 87, 1)"],
        borderWidth: 1,
      },
    ],
  };

  const options: any = {
    indexAxis: "y",
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      yAxis: [
        {
          ticks: {
            min: 1,
            precision: 0,
          },
        },
      ],
    },
  };

  return (
    <BaseResults element={element}>
      <div className="flow-root px-8 my-4 mt-6 text-center">
        <Chart type="bar" data={data} options={options} height={75} />
      </div>
    </BaseResults>
  );
}

import register from "preact-custom-element";

const Survey = ({ name = "World" }) => <Survey name={name} />;

register(Survey, "survey", ["name"]);

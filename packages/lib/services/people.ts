type TransformPersonInput = {
  id: string;
  attributes: {
    value: string;
    attributeClass: {
      name: string;
    };
  }[];
};

type TransformPersonOutput = {
  id: string;
  attributes: Record<string, string | number>;
};

export const transformPrismaPerson = (person: TransformPersonInput | null): TransformPersonOutput | null => {
  if (person === null) {
    return null;
  }

  const attributes = person.attributes.reduce((acc, attr) => {
    acc[attr.attributeClass.name] = attr.value;
    return acc;
  }, {} as Record<string, string | number>);

  return {
    id: person.id,
    attributes: attributes,
  };
};

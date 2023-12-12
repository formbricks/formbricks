export function formatDate(dateString: string) {
  return new Date(`${dateString}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function generateManagementApiMetadata(title, methods) {
  // Create a string from the methods array, formatted for title and description
  const formattedMethods = methods.join(", ").replace(/, ([^,]*)$/, " or $1");
  return {
    title: `Formbricks ${title} API: ${
      formattedMethods.charAt(0).toUpperCase() + formattedMethods.slice(1)
    } ${title}`,
    description: `Dive into Formbricks' ${title} API within the Public Client API suite. This API is designed for ${formattedMethods} operations on ${title}, facilitating client-side interactions without the need for authentication, thereby ensuring data privacy and efficiency.`,
  };
}

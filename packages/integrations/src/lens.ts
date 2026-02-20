const baseUrl = process.env.LENS_API_URL || "http://localhost:4010";

export async function getAppointments() {
  const response = await fetch(`${baseUrl}/appointments`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Lens API failed: ${response.status}`);
  }
  return response.json();
}

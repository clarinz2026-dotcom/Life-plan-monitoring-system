/**
 * Planholder fields probe — prints the Planholder Information rows of the
 * generated SOA so the address / email split can be eyeballed on the printed
 * statement. Read-only; generates no data.
 */
import { generateSOAHTML, splitAddressEmail, type SOAData } from "../src/components/SOADocument";

const contact = splitAddressEmail(
  "dclarinz2026@gmail.com, Malaybalay City, Bukidnon",
  "dclarinz2026@gmail.com"
);

const data: SOAData = {
  clientName: "Dela Cruz, Juan P.",
  clientAddress: contact.address,
  clientEmail: contact.email,
  clientContact: "0917 000 0000",
  clientBirthDate: "March 4, 1980",
  clientAge: 46,
  generatedDate: "09/26/2026",
  accountNumber: "0001",
  contracts: [],
  payments: [],
  beneficiaries: [],
};

const html = generateSOAHTML(data);
const fields = html.match(/<table class="fields">[\s\S]*?<\/table>/)?.[0] ?? "";
const strip = (s: string) =>
  s
    .replace(/<\/td>/g, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+\|/g, " |")
    .trim();

for (const row of fields.match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
  console.log(strip(row));
}

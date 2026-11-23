import { receipt } from "./record.js";
const sample = {
  client: "Marrow & Pine Studio",
  formUrl: "https://marrow-pine.example/enquiries",
  destination: "Sales / New enquiries",
  reference: "AS-54DA39F0C2",
  pageResult: "confirmed",
  pageNote: "Thank you. The studio will reply within two working days.",
  filed: "2026-11-18T10:16:00Z",
  pageAt: "2026-11-18T10:13:00Z",
  deliveryAt: "2026-11-18T10:15:00Z",
};
const outcomes = {
  arrived: {
    deliveryResult: "matched",
    deliveryNote: "New enquiry · QA test AS-54DA39F0C2",
    next: "Repeat at the December care review.",
  },
  missing: {
    deliveryResult: "missing",
    deliveryNote:
      "Searched New enquiries and Spam for the reference ten minutes after submission. No entry found.",
    next: "Check the form notification route and repeat after the fix.",
  },
  unavailable: {
    deliveryResult: "unavailable",
    deliveryNote:
      "The client owns the receiving inbox. Access was unavailable during the check.",
    next: "Ask the inbox owner to find the reference and confirm the destination.",
  },
};
function show(which) {
  document.querySelector("#sample").innerHTML = receipt(
    { ...sample, ...outcomes[which] },
    "",
    true,
  );
  for (const button of document.querySelectorAll("[data-case]"))
    button.setAttribute("aria-pressed", String(button.dataset.case === which));
}
for (const button of document.querySelectorAll("[data-case]"))
  button.onclick = () => show(button.dataset.case);
document.getElementById("print").onclick = () => print();
show("arrived");

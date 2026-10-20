const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

const csvPath = path.join(__dirname, "../src/data/sample-reviews.csv");
const rawContent = fs.readFileSync(csvPath, "utf8");
const parsed = Papa.parse(rawContent, { header: true });
const rows = parsed.data.filter((r) => r.text && r.text.trim().length > 0);

// Pool of repeat customer IDs to reuse for multi-touch reviews
const repeatCustomerPool = [
  { id: "cust_ent_101", orders: 12, segment: "enterprise", region: "NA", product: "PulseIQ Enterprise" },
  { id: "cust_ent_102", orders: 8, segment: "enterprise", region: "EU", product: "PulseIQ Enterprise" },
  { id: "cust_ent_103", orders: 15, segment: "enterprise", region: "NA", product: "PulseIQ Enterprise" },
  { id: "cust_vip_201", orders: 6, segment: "VIP", region: "EU", product: "PulseIQ Pro" },
  { id: "cust_vip_202", orders: 7, segment: "VIP", region: "APAC", product: "PulseIQ Pro" },
  { id: "cust_rep_301", orders: 4, segment: "repeat", region: "NA", product: "PulseIQ Pro" },
  { id: "cust_rep_302", orders: 3, segment: "repeat", region: "EU", product: "PulseIQ Pro" },
  { id: "cust_rep_303", orders: 5, segment: "repeat", region: "LATAM", product: "PulseIQ Pro" },
  { id: "cust_rep_304", orders: 9, segment: "repeat", region: "NA", product: "PulseIQ Enterprise" },
];

const regions = ["NA", "EU", "APAC", "LATAM"];
const products = ["PulseIQ Web", "PulseIQ Pro", "PulseIQ Enterprise", "PulseIQ Mobile"];

let newCustCounter = 100;
let repCustCounter = 400;

const enriched = rows.map((row, index) => {
  const text = row.text;
  const rating = parseInt(row.rating, 10) || 3;
  const isPricing = /price|cost|tier|seat|expensive|contract|renew|charge|fee|refund/i.test(text);
  const isLargeBoardOrExport = /export|csv|pdf|board|100 tasks|enterprise|large/i.test(text);
  const isOnboarding = /onboard|wizard|hierarchy|invite|sign-up|first time|getting started/i.test(text);

  let customerId = "";
  let orderCount = "";
  let customerSegment = "";
  let region = regions[index % regions.length];
  let product = products[index % products.length];

  // Specific targeting for realistic distribution
  if (isPricing || isLargeBoardOrExport) {
    // 85% repeat customers complaining about renewals, seat minimums, enterprise board export crashes
    if (index % 10 !== 0) {
      const rep = repeatCustomerPool[index % repeatCustomerPool.length];
      customerId = rep.id;
      orderCount = String(rep.orders);
      customerSegment = rep.segment;
      region = rep.region;
      product = rep.product;
    } else {
      // 10% new customer evaluating pricing
      customerId = `cust_new_${newCustCounter++}`;
      orderCount = "1";
      customerSegment = "starter";
      product = "PulseIQ Web";
    }
  } else if (isOnboarding) {
    // New customers struggle with onboarding & invites
    customerId = `cust_new_${newCustCounter++}`;
    orderCount = "1";
    customerSegment = index % 2 === 0 ? "new" : "trial";
    product = "PulseIQ Web";
  } else if (rating <= 2) {
    // General bugs / negative feedback
    if (index % 2 === 0) {
      const rep = repeatCustomerPool[index % repeatCustomerPool.length];
      customerId = rep.id;
      orderCount = String(rep.orders);
      customerSegment = rep.segment;
      product = rep.product;
    } else {
      customerId = `cust_new_${newCustCounter++}`;
      orderCount = "1";
      customerSegment = "new";
      product = "PulseIQ Web";
    }
  } else {
    // Positive & neutral reviews
    if (index % 3 === 0) {
      const rep = repeatCustomerPool[index % repeatCustomerPool.length];
      customerId = rep.id;
      orderCount = String(rep.orders);
      customerSegment = rep.segment;
      product = rep.product;
    } else if (index % 3 === 1) {
      customerId = `cust_new_${newCustCounter++}`;
      orderCount = "1";
      customerSegment = "new";
      product = "PulseIQ Web";
    } else {
      repCustCounter++;
      customerId = `cust_rep_${repCustCounter}`;
      orderCount = String((repCustCounter % 5) + 2);
      customerSegment = "pro_annual";
      product = "PulseIQ Pro";
    }
  }

  // 5% edge case: anonymous / missing segment
  if (index % 25 === 0) {
    customerId = "";
    orderCount = "";
    customerSegment = "";
  }

  return {
    text: row.text,
    rating: row.rating,
    source: row.source,
    product_version: row.product_version,
    occurred_at: row.occurred_at,
    customer_id: customerId,
    order_count: orderCount,
    customer_segment: customerSegment,
    region,
    product,
  };
});

// Add additional explicit new-customer onboarding and invite feedback items
const newCustomerReviews = [
  {
    text: "The 7-step onboarding wizard is so confusing; it forced me to invite 3 teammates before I could even see the workspace dashboard.",
    rating: "2",
    source: "In-App NPS",
    product_version: "v2.5.2",
    occurred_at: "2026-10-06T11:20:00Z",
    customer_id: "cust_new_501",
    order_count: "1",
    customer_segment: "new",
    region: "NA",
    product: "PulseIQ Web",
  },
  {
    text: "Workspace hierarchy is completely unintuitive. What is the difference between an Organization, a Workspace, and a Folder? Our new team is completely lost.",
    rating: "2",
    source: "Support Ticket",
    product_version: "v2.5.2",
    occurred_at: "2026-10-08T15:30:00Z",
    customer_id: "cust_new_502",
    order_count: "1",
    customer_segment: "new",
    region: "EU",
    product: "PulseIQ Web",
  },
  {
    text: "Invite links expire after only 10 minutes! Half our invited engineers received expired token errors before they could set up their passwords.",
    rating: "1",
    source: "Zendesk",
    product_version: "v2.5.2",
    occurred_at: "2026-10-11T09:45:00Z",
    customer_id: "cust_new_503",
    order_count: "1",
    customer_segment: "new",
    region: "NA",
    product: "PulseIQ Web",
  },
  {
    text: "Sign-up wizard froze during the initial project template selection step. Had to refresh twice and restart account creation.",
    rating: "2",
    source: "G2",
    product_version: "v2.5.1",
    occurred_at: "2026-09-29T14:15:00Z",
    customer_id: "cust_new_504",
    order_count: "1",
    customer_segment: "trial",
    region: "APAC",
    product: "PulseIQ Web",
  },
  {
    text: "As a first time user, finding how to create a simple private project was buried 4 menus deep. The initial onboarding tutorial skips permissions entirely.",
    rating: "2",
    source: "Capterra",
    product_version: "v2.5.0",
    occurred_at: "2026-09-17T16:00:00Z",
    customer_id: "cust_new_505",
    order_count: "1",
    customer_segment: "trial",
    region: "EU",
    product: "PulseIQ Web",
  },
  {
    text: "Super clean onboarding UI! Took less than 3 minutes to import our backlog from Trello and start running sprint planning.",
    rating: "5",
    source: "G2",
    product_version: "v2.5.2",
    occurred_at: "2026-10-09T18:00:00Z",
    customer_id: "cust_new_506",
    order_count: "1",
    customer_segment: "new",
    region: "NA",
    product: "PulseIQ Web",
  },
  {
    text: "Team invite emails are landing in Spam folders for Google Workspace users. Took us 2 days to realize why new teammates hadn't joined.",
    rating: "2",
    source: "Support Ticket",
    product_version: "v2.5.2",
    occurred_at: "2026-10-12T13:10:00Z",
    customer_id: "cust_new_507",
    order_count: "1",
    customer_segment: "new",
    region: "LATAM",
    product: "PulseIQ Web",
  },
  {
    text: "After 3 years on the Enterprise plan, hitting a surprise 65% price hike on renewal and 10-seat minimums is forcing our procurement team to review alternative vendors.",
    rating: "1",
    source: "Support Ticket",
    product_version: "v2.5.2",
    occurred_at: "2026-10-14T10:15:00Z",
    customer_id: "cust_ent_101",
    order_count: "12",
    customer_segment: "enterprise",
    region: "NA",
    product: "PulseIQ Enterprise",
  },
  {
    text: "We have over 200 tasks in our quarterly board. Exporting to CSV locks up our browser tab with 100% CPU usage every single time.",
    rating: "1",
    source: "Zendesk",
    product_version: "v2.5.2",
    occurred_at: "2026-10-15T14:40:00Z",
    customer_id: "cust_ent_102",
    order_count: "8",
    customer_segment: "enterprise",
    region: "EU",
    product: "PulseIQ Enterprise",
  },
];

const allRows = [...enriched, ...newCustomerReviews];

const outputCsv = Papa.unparse(allRows, {
  quotes: true,
  header: true,
});

fs.writeFileSync(csvPath, outputCsv, "utf8");
console.log(`Enriched ${allRows.length} reviews in ${csvPath}`);

// Also copy to data/test-feedback.csv and public/test-feedback.csv
const testFeedbackPath = path.join(__dirname, "../data/test-feedback.csv");
const publicFeedbackPath = path.join(__dirname, "../public/test-feedback.csv");
fs.writeFileSync(testFeedbackPath, outputCsv, "utf8");
fs.writeFileSync(publicFeedbackPath, outputCsv, "utf8");
console.log(`Copied to ${testFeedbackPath} and ${publicFeedbackPath}`);

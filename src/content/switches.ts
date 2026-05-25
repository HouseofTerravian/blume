/**
 * The 7 Sales Switches™
 * BLUME's core framework for moving brands from $0 to momentum.
 */

export type SwitchNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface SalesSwitch {
  number: SwitchNumber;
  name: string;
  subtitle: string;
  bottleneck: string;
  focus: string;
  actions: string[];
  kpis: string[];
  nextSwitch: string;
}

export const SEVEN_SWITCHES: Record<SwitchNumber, SalesSwitch> = {
  1: {
    number: 1,
    name: "The Spark Switch",
    subtitle: "Offer & Audience Alignment",
    bottleneck: "You don't have a clear offer or you don't know who buys it",
    focus: "Clarify what you're selling and who buys it",
    actions: [
      "Create a one-liner pitch and clear value promise",
      "Identify the single easiest starter audience",
      "Name one product or service to lead with",
      "Define what transformation you deliver",
    ],
    kpis: ["Can you explain your offer in 1 sentence?", "Can you name your buyer in 1 sentence?"],
    nextSwitch: "Once offer + audience are clear, move to Switch 2: Build the audience",
  },
  2: {
    number: 2,
    name: "The Magnet Switch",
    subtitle: "Audience Building",
    bottleneck: "You have an offer but no one knows about it",
    focus: "Grow an audience using free strategies first",
    actions: [
      "Set up email list capture (lead magnet)",
      "Identify where your audience lives online and offline",
      "Start DM outreach to ideal customers",
      "Begin consistent content on 1–2 platforms (not all)",
    ],
    kpis: ["Email list size", "Social following on primary platform", "DMs sent per week"],
    nextSwitch: "Once you have consistent audience growth, move to Switch 3: Get traffic",
  },
  3: {
    number: 3,
    name: "The Traffic Switch",
    subtitle: "Getting Eyeballs on Your Offer",
    bottleneck: "People aren't finding you or your offer",
    focus: "Drive daily traffic via content, micro-ads, or free publicity",
    actions: [
      "Post content daily on primary platform",
      "Run a micro-budget ad ($5–$20/day) to test messaging",
      "Pursue free press: podcast guesting, collabs, features",
      "Build SEO content or social search visibility",
    ],
    kpis: ["Daily website visitors", "Profile views / reach", "Ad CTR"],
    nextSwitch: "Once traffic is consistent, move to Switch 4: Warm up the leads",
  },
  4: {
    number: 4,
    name: "The Connection Switch",
    subtitle: "Lead Warm-Up & Trust Building",
    bottleneck: "People visit but don't buy — they don't trust you yet",
    focus: "Send automated warming sequences; build trust before pitching",
    actions: [
      "Build a 5–7 email welcome sequence",
      "Share stories, proof, and helpful tips before any offer",
      "Engage with every comment and DM personally",
      "Add social proof (testimonials, case studies) to all touchpoints",
    ],
    kpis: ["Email open rate", "Reply rate to DMs", "Time from first touch to first sale"],
    nextSwitch: "Once trust is built, move to Switch 5: Convert and close",
  },
  5: {
    number: 5,
    name: "The Yes Switch",
    subtitle: "Conversion & Closing",
    bottleneck: "You have warm leads but you're not converting them",
    focus: "Optimize offer page and checkout; create urgency; provide closing scripts",
    actions: [
      "Audit your sales/offer page for clarity and urgency",
      "Add scarcity elements (limited spots, expiring bonuses)",
      "Write DM/call closing scripts for common objections",
      "A/B test your CTA copy",
    ],
    kpis: ["Conversion rate (visitors to buyers)", "Cart abandonment rate", "Close rate on calls/DMs"],
    nextSwitch: "Once converting consistently, move to Switch 6: Get them to buy again",
  },
  6: {
    number: 6,
    name: "The Growth Switch",
    subtitle: "Retention & Referrals",
    bottleneck: "You're making first sales but not repeat sales or referrals",
    focus: "Turn happy customers into loyal buyers and brand evangelists",
    actions: [
      "Create a post-purchase sequence (onboarding + delight emails)",
      "Launch a simple referral program or affiliate offer",
      "Collect and publish testimonials and reviews actively",
      "Introduce a next product or upsell within 30 days of first purchase",
    ],
    kpis: ["Repeat purchase rate", "Referral count per month", "Customer LTV"],
    nextSwitch: "Once retention is strong, move to Switch 7: Track and scale",
  },
  7: {
    number: 7,
    name: "The Compass Switch",
    subtitle: "Tracking & Adjusting",
    bottleneck: "You don't know which Switch is the real bottleneck right now",
    focus: "Identify current bottleneck, track numbers, and suggest the next most profitable move",
    actions: [
      "Build a simple weekly dashboard: traffic, conversions, revenue, LTV",
      "Identify which Switch number you're stuck in right now",
      "Run a 30-day experiment on one variable at a time",
      "Review and adjust every 2 weeks",
    ],
    kpis: ["Weekly revenue trend", "Primary bottleneck identified", "Experiment velocity"],
    nextSwitch: "The Compass Switch is always active — it routes you back to the right Switch",
  },
};

export function diagnoseSwitchFromContext(context: string): SwitchNumber {
  const lower = context.toLowerCase();
  if (lower.includes("no offer") || lower.includes("don't know what to sell") || lower.includes("unclear")) return 1;
  if (lower.includes("no audience") || lower.includes("no followers") || lower.includes("nobody knows")) return 2;
  if (lower.includes("no traffic") || lower.includes("no visitors") || lower.includes("no views")) return 3;
  if (lower.includes("no trust") || lower.includes("not converting") || lower.includes("people visit but")) return 4;
  if (lower.includes("warm leads") || lower.includes("not closing") || lower.includes("objections")) return 5;
  if (lower.includes("no repeat") || lower.includes("no referrals") || lower.includes("one-time buyers")) return 6;
  return 7;
}

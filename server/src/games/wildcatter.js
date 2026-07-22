// wildcatter.js — Unit 6 game adapter: "Wildcatter" (SOLO, one class-wide group).
// Everyone is an independent oil driller — a "wildcatter" — working the Texas oil
// boom from Spindletop (1901) to the East Texas field (1930–31). Six eras × 2
// graded decisions = 12 graded actions. There is no "pick" and no rival — the
// whole class drills the same thirty years, so the Teacher Command Center reports
// ONE accuracy group.
//
// THE TEACHING IDEA (spec §1): boom-and-bust is not a vocabulary word here — it is
// the PRICE TICKER. Students watch oil crash from about $1.85 a barrel to just
// THREE CENTS in the post-Spindletop glut, feel why more wells can mean less
// money, and learn the era's real solutions (pace production, sign steady
// contracts, and, by 1931, prorationing). That is TEKS 7.7B by experience and
// 7.12B (supply and demand) for free; 7.7A (oil industrializes Texas) and 7.1B
// (1901 Spindletop) ride in the events and the debrief.
//
// THE DESIGN THAT MAKES THIS GAME HONEST (spec §3): the PRICE TICKER (see below)
// is a scripted, display-only value — NOT a meter, NOT scored, NEVER touched by a
// choice. History drives it: it spikes and crashes on schedule, and the RIGHT
// choices are the ones that respect it. Unlike the sibling debt game, this game
// has NO scripted eventEffects meter tolls: every change to Cash / Wells /
// Reputation comes from the player's own 12 decisions and nothing else. There is
// also NO early-fail — the wildcatter always drills all thirty years.
//
// SENSITIVITY (Common Standards §3 & this game's spec note): swindler-era fraud —
// fake "guaranteed" shares, sight-unseen scams, hidden contract fine print, hot-oil
// smuggling — is graded WRONG via Reputation hits in every era, and the feedback
// names it as wrong, never clever. No gore in well-accident language (danger is
// named as fire and lost men, not spectacle).
//
// THE ANSWER KEY LIVES HERE, ON THE SERVER (verdicts/effects/feedback). The
// factory ships labels only; the client submits { kind, choiceIndex }.
// Student-facing text is written at a 5th grade reading level.
//
// Every step is a 'decision.' ✅ right (+1) · ⚠️ partial (+0.5) · ❌ wrong (0).

import { createStepGame } from './_stepGame.js';

// ---------------------------------------------------------------------------
// Shared board metadata (shipped to clients at match:begin — display info only)
// ---------------------------------------------------------------------------

export const METERS = {
  cash:       { name: 'Cash',       icon: 'cash',       blurb: 'Money on hand — the dollars to lease land, pay your crew, and buy the next rig before the boom moves on.' },
  wells:      { name: 'Wells',      icon: 'wells',      blurb: 'Your producing capacity — how many wells are down and pumping oil you can actually sell.' },
  reputation: { name: 'Reputation', icon: 'reputation', blurb: 'Trust with crews, landowners, and buyers — the good name a swindler never keeps and a driller lives on.' },
};

// No map in this game, so there are no placed markers. Kept for engine symmetry.
export const MARKERS = {
  wildcatter: { name: 'The Wildcatter' },
};

// All three meters begin at 50: a little money, a little capacity, and a name
// nobody has heard of yet.
const START_METERS = { cash: 50, wells: 50, reputation: 50 };

// Wildcatter Score = cash + wells + reputation (max 300).
export function wildcatterScore(meters) {
  return (meters.cash || 0) + (meters.wells || 0) + (meters.reputation || 0);
}

// ---------------------------------------------------------------------------
// THE OIL-PRICE TICKER — scripted, display-only, unstoppable. Values in CENTS
// per barrel (integers, to dodge float trouble; the client formats them: under
// 100 shows as "3¢"/"45¢", 100+ shows as dollars, e.g. "$1.85"). Each era carries
// the price ENTERING the era and AFTER it plays out; the client animates the
// swing. Era 6 also carries a settle value: on the RESULT screen only, after a
// short beat the price climbs back to about a dollar (1931 prorationing) — the
// bust that finally taught Texas to manage the boom. The ticker is NOT a meter,
// is NOT affected by choices, and is NOT scored. History drives it. (Anchors:
// under $2 before Spindletop; the ~3¢ glut of 1901–02; ~$1.65 by the mid-1920s;
// the East Texas crash of 1930–31 and prorationing.)
// ---------------------------------------------------------------------------

export const PRICE_TICKER = [
  { era: 1, startCents: 185, endCents: 150,
    note: 'Before the gusher, oil sold for under two dollars a barrel -- scarce and steady. News of Spindletop is already spreading, and buyers can smell a flood coming.' },
  { era: 2, startCents: 150, endCents: 75,
    note: 'Wells across the field are roaring in. More oil on the market every day means the price is already sliding.' },
  { era: 3, startCents: 75, endCents: 3,
    note: 'The crash Texas would never forget: with too many wells and nowhere to store the oil, the price bottoms out at just three cents a barrel -- worth less than a bucket of water.' },
  { era: 4, startCents: 3, endCents: 45,
    note: 'Slowly, as wild pumping eases and steady contracts take hold, the price claws back up from the bottom.' },
  { era: 5, startCents: 45, endCents: 165,
    note: 'Over the next two decades, new fields, pipelines, and refineries settle into a steadier business. By the 1920s, a barrel of Texas crude fetches well over a dollar again.' },
  { era: 6, startCents: 100, endCents: 10,
    note: 'Then East Texas blows the whole business open again -- the biggest field yet, and prices are already sliding toward another crash. Just like 1901: too much oil, too fast.',
    settleCents: 100,
    settleNote: 'In 1931, the Railroad Commission orders prorationing -- limits on how much each well may pump. Slowly, the price climbs back to about a dollar a barrel. The bust that finally taught Texas to manage the boom.' },
];

// ---------------------------------------------------------------------------
// ENDINGS — meters → tiers (spec §3). Score = cash + wells + reputation (max 300).
// Thresholds verified against a real initMatch/resolve sim (see content.test.js):
//   all-right   → cash 70,  wells 100 (clamped), reputation 100 (clamped) = 270 → top
//   all-partial → cash 55,  wells 70,            reputation 45            = 170 → mid
//   all-wrong   → cash 35,  wells 20,            reputation 0 (clamped)   = 55  → low
// The three tier names/titles are fixed by the spec and content bank.
// ---------------------------------------------------------------------------

export const ENDINGS = {
  top: { key: 'top', title: 'Oil Finds Character',
         text: 'You started with a little money and a lot of nerve, and you ended with something rarer: a good name. You read the rocks when the crowd read rumors. You capped your wells, paid your crews, and slowed your pumps when the glut hit three cents. You built water lines and pipelines instead of just chasing gushers. Texas struck oil in 1901 -- but oil also struck Texas, and it found out what everyone was made of. It found out what you were made of, too. The wells will slow someday. Your word won\'t.' },
  mid: { key: 'mid', title: 'Still Drilling',
         text: 'You\'re still here -- and in the oil patch, that\'s saying something. You rode the booms, took your lumps in the busts, and made some calls you\'d love to have back. Maybe you pumped too hard into a glut, or squeezed when you should have built. But you never quit, and your derrick is still turning. Every old driller in Texas has scars like yours; the wise ones turned them into lessons. There\'s oil in the ground yet, wildcatter. Go find it.' },
  low: { key: 'low', title: 'Busted Flat in Beaumont',
         text: 'The boom got you -- the way it got thousands of others. Maybe you chased the crowd instead of the rocks. Maybe you pumped hard into a glut and watched three-cent oil drown you. Maybe you cut corners that cost you the trust a driller can\'t work without. Here\'s the truth the oil patch teaches: busting flat isn\'t the end of a wildcatter\'s story. Half the legends of Texas oil went broke at least once, dusted off their hats, and drilled again. The ground is still down there. So is your next chance.' },
};

export function endingFor(score) {
  if (score >= 200) return ENDINGS.top;
  if (score >= 120) return ENDINGS.mid;
  return ENDINGS.low;
}

// ---------------------------------------------------------------------------
// DEBRIEF — the true story, and the 7.7A/7.7B/7.12B landing (shown on every ending).
// ---------------------------------------------------------------------------

export const DEBRIEF =
  'On January 10, 1901, the Lucas Gusher blew in at Spindletop, and Texas changed for good. Oil turned a farming and ranching state into an industrial one. Refineries, pipelines, and busy Gulf ports rose along the coast, and companies born in the boom -- like Texaco and Gulf -- grew into giants. Oil money built roads, cities, and even universities. But the boom came with a hard lesson stapled to it. So much oil flooded the market in 1901 that the price crashed to about three cents a barrel -- less than water. That\'s supply and demand: when there\'s far more of something than people want, its price falls. Texas lived that lesson again in 1930, when the giant East Texas field crashed prices a second time. This time the state answered with prorationing -- limits on how much each well could pump -- and the wild boom finally learned some manners. Boom, bust, and the lessons in between: that\'s the story of oil in Texas, and now it\'s a story you\'ve lived.';

// ===========================================================================
// THE SIX ERAS, 1901–1931. The oil-price ticker swings through all of them.
// No scripted eventEffects — every meter change comes from the player's choices.
// Player-facing text at a 5th grade reading level.
// ===========================================================================

const PHASES = [

  // ---- Era 1 — The Gusher (Beaumont, January 1901) ----
  {
    title: 'The Gusher', date: 'Beaumont · January 1901', image: 'event_gusher.jpg',
    price: PRICE_TICKER[0],
    event: 'January 10, 1901. Near Beaumont, a well called the Lucas Gusher blows oil a hundred feet into the sky. It will roar for nine days -- around 100,000 barrels every day. Patillo Higgins swore for years there was oil under that hill, and everybody laughed. Nobody is laughing now. You have a little money, a strong back, and a choice to make.',
    steps: [
      {
        kind: 'decision',
        prompt: 'Spindletop just blew in. Every fool with a dollar is running to Beaumont. What\'s your first move?',
        choices: [
          { label: 'Buy the cheapest lease you can get, sight unseen.',
            verdict: 'partial', effects: { cash: -10, wells: 5 },
            feedback: 'Some sight-unseen leases hit. Most watered the swindlers\' gardens.' },
          { label: 'Skip leases -- sell "guaranteed" shares in a well you haven\'t drilled.',
            verdict: 'wrong', effects: { reputation: -15 },
            feedback: 'That\'s the "Swindletop" game. It made fast money and faster enemies -- and it\'s not who you are.' },
          { label: 'Study the ground first -- lease near the salt dome, where the geology says oil, not where the crowd says it.',
            verdict: 'right', effects: { wells: 10, cash: -5 },
            feedback: 'Patillo Higgins was right about the hill because he studied it when everyone laughed. Rocks beat rumors.' },
        ],
      },
      {
        kind: 'decision',
        prompt: 'How do you drill?',
        choices: [
          { label: 'The old cable-tool rig you know.',
            verdict: 'partial', effects: { wells: 5 },
            feedback: 'Cable tools drilled half of Texas before 1901. But they pound the rock instead of turning through it. On soft salt-dome ground, old tools mean slow wells.' },
          { label: 'The new rotary rig with drilling mud -- slower to set up, right for this ground.',
            verdict: 'right', effects: { wells: 15 },
            feedback: 'The rotary rig and drilling mud were the two technologies Spindletop proved. They were slower to set up -- and exactly right for this soft salt-dome ground.' },
          { label: 'Cheapest crew, no mud.',
            verdict: 'wrong', effects: { wells: -10 },
            feedback: 'Gas pressure with no mud is how wells and men were lost. Drilling mud holds back the pressure -- skip it to save a dollar and you risk everything.' },
        ],
      },
    ],
  },

  // ---- Era 2 — Gusher Control (Spindletop, 1901) ----
  {
    title: 'Gusher Control', date: 'Spindletop · 1901', image: 'event_craft.jpg',
    price: PRICE_TICKER[1],
    event: 'Your drill bites into the salt dome -- and the ground answers. Oil roars over the top of your derrick and rains down black on everything. A crowd is already gathering to watch the show. The Lucas Gusher ran wild for nine days before anyone could cap it. Now it\'s your turn to decide.',
    steps: [
      {
        kind: 'decision',
        prompt: 'Your well is spraying a fortune into the sky. What do you do?',
        choices: [
          { label: 'Cap the well now, even if it takes every hand you\'ve got.',
            verdict: 'right', effects: { wells: 10, reputation: 5 },
            feedback: 'Every barrel in the sky is a barrel you can\'t sell. The Lucas Gusher wasted a lake of oil before it was capped. Worse, one spark near that much loose oil means fire. Good drillers cap fast -- for the money and for the men.' },
          { label: 'Let it spray one more day -- the crowd is paying to watch, and it\'s great advertising.',
            verdict: 'partial', effects: { cash: 5, wells: -5 },
            feedback: 'Gawkers really did pay to see gushers blow. But you traded a day of oil for a day of applause. The show made pennies. The waste cost dollars.' },
          { label: 'Let it run wild. A gusher this big will never run dry.',
            verdict: 'wrong', effects: { wells: -15, reputation: -5 },
            feedback: 'Every field that ever boomed also slowed down. Oil pooling on open ground is wasted money and waiting fire. Letting a well run wild told the whole field you didn\'t respect the oil or the danger.' },
        ],
      },
      {
        kind: 'decision',
        prompt: 'Buyers are swarming. Today\'s price is high because everyone is in a panic to get oil. How do you sell?',
        choices: [
          { label: 'Sell day by day, chasing whichever buyer shouts the highest number.',
            verdict: 'partial', effects: { cash: 5 },
            feedback: 'Some days you won. Some days the shouting stopped and you sold cheap. Chasing spikes is gambling with extra steps.' },
          { label: 'Hold every barrel in open pits and wait for the price to double.',
            verdict: 'wrong', effects: { cash: -10, wells: -5 },
            feedback: 'Oil in open earthen pits leaks, evaporates, and burns. And the price wasn\'t going up -- half of Texas was drilling right beside you. You held your breath while your fortune soaked into the ground.' },
          { label: 'Sign a steady contract -- a fair price for every barrel, month after month.',
            verdict: 'right', effects: { cash: 10, reputation: 5 },
            feedback: 'Panic prices never last. A contract is a promise, and promises are what a driller sells besides oil. Steady money let you plan, pay your crew, and sleep at night.' },
        ],
      },
    ],
  },

  // ---- Era 3 — The Glut (Beaumont, 1901–1902; price bottoms at 3¢) ----
  {
    title: 'The Glut', date: 'Beaumont · 1901–1902', image: 'event_glut.jpg',
    price: PRICE_TICKER[2],
    event: 'Look at the price ticker. Oil: three cents a barrel. In Beaumont today, a barrel of clean water costs more than a barrel of oil. Everyone pumped so much, so fast, that nobody wants to buy it all. That\'s called a glut -- far more for sale than anyone needs. The boom just showed you its other face.',
    steps: [
      {
        kind: 'decision',
        prompt: 'Three cents a barrel, and falling. What do you do with your wells?',
        choices: [
          { label: 'Keep pumping the same as always and hope the price comes back.',
            verdict: 'partial', effects: { cash: -5 },
            feedback: 'Hope is not a plan. You sold good oil for pennies while your costs stayed the same. The ground would have stored it for free.' },
          { label: 'Slow your pumps and lock in a long contract with a refiner.',
            verdict: 'right', effects: { cash: 10, reputation: 5 },
            feedback: 'This is supply and demand. When too much oil floods the market, the price falls -- and every extra barrel pushes it lower. Pumping less kept your oil in the ground, where it held its value. The contract gave you a steady buyer while the panic-sellers went broke.' },
          { label: 'Pump harder! Make up the low price with more barrels.',
            verdict: 'wrong', effects: { cash: -15 },
            feedback: 'This is the trap that broke drillers all over Spindletop. More barrels meant more supply, and more supply pushed the price even lower. You dug your own bust deeper with every stroke of the pump.' },
        ],
      },
      {
        kind: 'decision',
        prompt: 'The bust drags on. Payday is coming and money is tight. What about your crews?',
        choices: [
          { label: 'Pay your crews full wages, even if it drains your savings.',
            verdict: 'right', effects: { cash: -5, reputation: 15 },
            feedback: 'Drilling crews risked their lives on your derrick. They remember who paid them when the price ticker read three cents. When the next boom came, the best hands in Texas asked to work for you first.' },
          { label: 'Cut everyone to half pay until prices climb.',
            verdict: 'partial', effects: { cash: 5, reputation: -5 },
            feedback: 'It kept your books alive, and some bosses did worse. But your best men drifted to outfits that paid full. Half pay bought you half loyalty.' },
          { label: 'Let the crews go. You can hire new men cheap when the bust ends.',
            verdict: 'wrong', effects: { cash: 10, reputation: -15 },
            feedback: 'Word travels fast in the oil patch. The men you dropped told every camp from Beaumont to Houston. When you needed skilled hands again, the good ones remembered -- and walked past your gate.' },
        ],
      },
    ],
  },

  // ---- Era 4 — Boomtown Life (Beaumont, 1902–1904) ----
  {
    title: 'Boomtown Life', date: 'Beaumont · 1902–1904', image: 'event_boomtown.jpg',
    price: PRICE_TICKER[3],
    event: 'Beaumont was a quiet town of about 9,000 people. Almost overnight, it holds 50,000. Land prices have jumped a hundred times over. There isn\'t enough clean water, enough beds, or enough of anything. A boomtown can make you rich -- or it can rot from under you.',
    steps: [
      {
        kind: 'decision',
        prompt: 'The town is bursting. Workers sleep in mud and drink bad water. What\'s your move?',
        choices: [
          { label: 'Chip in a little for the church fund and get back to drilling.',
            verdict: 'partial', effects: { reputation: 5 },
            feedback: 'Better than nothing, and folks noticed. But a small gift doesn\'t fix bad water. The town\'s problems were still your problems -- you just paid to look away politely.' },
          { label: 'Put money into the town -- clean water and decent housing for the workers.',
            verdict: 'right', effects: { cash: -5, reputation: 15 },
            feedback: 'A boomtown only lasts if people can live in it. Healthy crews drill better wells, and neighbors talk. When landowners chose who got the next lease, they chose the driller who built the water line.' },
          { label: 'Buy up shacks and tents and rent them at sky-high prices. The workers have nowhere else to go.',
            verdict: 'wrong', effects: { cash: 10, reputation: -15 },
            feedback: 'Plenty of men squeezed the boom this way, and the boom remembered them. Charging a week\'s pay for a leaky tent made you money and enemies in the same breath. Landowners stopped answering your letters.' },
        ],
      },
      {
        kind: 'decision',
        prompt: 'A farmer south of town wants to lease you his land. He can\'t read the contract well. What do you offer?',
        choices: [
          { label: 'The going rate, but you rush the signing -- time is money.',
            verdict: 'partial', effects: { wells: 5 },
            feedback: 'You didn\'t cheat him. But you didn\'t make sure he understood, either. A deal a man doesn\'t understand is a deal he\'ll always half-regret -- and half-trust.' },
          { label: 'Slip fine print into the contract that keeps most of his royalty for you.',
            verdict: 'wrong', effects: { cash: 10, reputation: -15 },
            feedback: 'That\'s the swindler\'s trade in a suit and tie. It happened all over the boom, and it left families cheated out of their own land\'s riches. Money taken this way always costs more than it pays.' },
          { label: 'A fair lease with a fair royalty -- and you read him every line out loud.',
            verdict: 'right', effects: { wells: 5, reputation: 10 },
            feedback: 'A royalty is the landowner\'s share of the oil money. Paying it fairly cost you a little and bought you something rare in a boomtown: a good name. Every farmer in the county heard about the driller whose word was good.' },
        ],
      },
    ],
  },

  // ---- Era 5 — Chasing New Fields (Sour Lake, Humble, and beyond, 1903–1920s) ----
  {
    title: 'Chasing New Fields', date: 'Sour Lake, Humble, and beyond · 1903–1920s', image: 'event_believer.jpg',
    price: PRICE_TICKER[4],
    event: 'Spindletop\'s wells are slowing down. Booms don\'t stay put -- they move. New gushers are blowing in at Sour Lake, Humble, and Batson, each one on ground a lot like that first salt dome. Meanwhile, new companies born at Spindletop -- names like Texaco and Gulf -- are growing into giants. Where does a wildcatter go next?',
    steps: [
      {
        kind: 'decision',
        prompt: 'The old hill is fading. Where do you drill?',
        choices: [
          { label: 'Hire a geologist and follow the salt domes to the next field.',
            verdict: 'right', effects: { wells: 15, cash: -5 },
            feedback: 'A geologist is a scientist who reads the rocks. Sour Lake, Humble, and Batson all sat on ground like Spindletop\'s -- the oil followed the geology, not the crowds. Higgins taught you this in 1901. It was still true.' },
          { label: 'Drill more wells on old Spindletop hill. It paid once, didn\'t it?',
            verdict: 'partial', effects: { wells: 5, cash: -5 },
            feedback: 'There was still some oil there. But hundreds of wells were sipping from the same shrinking pool. Drilling where the last boom happened is how you arrive at every party after it ends.' },
          { label: 'Buy leases from a stranger selling maps to a "secret guaranteed field."',
            verdict: 'wrong', effects: { cash: -15 },
            feedback: 'Nobody sells a map to a fortune -- they sell the map instead of the fortune. The swindlers followed the booms just like the drillers did. His "secret field" was a cow pasture, and your money left town with him.' },
        ],
      },
      {
        kind: 'decision',
        prompt: 'You\'ve made real money. What do you do with it?',
        choices: [
          { label: 'Stay a pure wildcatter. Drilling is what you know.',
            verdict: 'partial', effects: { wells: 5 },
            feedback: 'It\'s an honest life, and Texas needed its wildcatters. But a driller with nothing else rides every bust at full speed. The men who owned a piece of the pipeline got paid in booms and busts.' },
          { label: 'Buy a mansion, a fast car, and the best table in every restaurant in Houston.',
            verdict: 'wrong', effects: { cash: -15 },
            feedback: 'Plenty of oil fortunes vanished exactly this way. A mansion doesn\'t pump a single barrel. When the next bust came, the flashy men sold their cars -- the careful men bought them cheap.' },
          { label: 'Put profits into a pipeline and a share of a refinery.',
            verdict: 'right', effects: { cash: 10, wells: 5 },
            feedback: 'Crude oil is worth little until it\'s moved and refined into fuel. Pipelines, refineries, and Gulf coast ports turned Texas from a place that found oil into a place that ran the oil business. That\'s how boom money became lasting industry.' },
        ],
      },
    ],
  },

  // ---- Era 6 — East Texas (The Piney Woods, 1930–1931) ----
  {
    title: 'East Texas', date: 'The Piney Woods · 1930–1931', image: 'event_ending.jpg',
    price: PRICE_TICKER[5],
    event: '1930. Deep in the East Texas pines, an old wildcatter named "Dad" Joiner brings in the Daisy Bradford No. 3 -- and opens the biggest oil field anyone has ever seen. Thousands of wells follow. Once again there is far too much oil, and once again prices crash toward pennies. Thirty years after Spindletop, Texas faces the same test. So do you.',
    steps: [
      {
        kind: 'decision',
        prompt: 'The Railroad Commission sets prorationing -- limits on how much each well can pump -- to stop the crash. Drillers are furious. Where do you stand?',
        choices: [
          { label: 'Support the limits. If everyone pumps less, the price can live -- and so can the field.',
            verdict: 'right', effects: { cash: 10, reputation: 10 },
            feedback: 'Prorationing was the lesson of 1901 finally written into law. The three-cent glut taught Texas that a wild boom drowns itself. Shared limits kept the price steady, the oil lasting, and the drillers in business. The bust taught Texas to manage the boom.' },
          { label: 'Follow the limits -- but only when the inspectors are watching.',
            verdict: 'partial', effects: { cash: 5, reputation: -5 },
            feedback: 'They had a name for oil pumped past the limit: "hot oil." Half-following the rules meant half-breaking them. Every hot barrel pushed the price down on your honest neighbors -- and on you.' },
          { label: 'Pump past the limit at night and sell the extra in secret.',
            verdict: 'wrong', effects: { cash: 5, reputation: -15 },
            feedback: 'Hot oil money spent fine until the checks came. Cheating the limits deepened the very crash the limits were built to stop. You made pennies tonight and helped break the price for everyone -- including yourself.' },
        ],
      },
      {
        kind: 'decision',
        prompt: 'Thirty years in the oil patch. Gushers, gluts, booms, and busts. What do you leave behind?',
        choices: [
          { label: 'Sell out quietly, bank the money, and keep your lessons to yourself.',
            verdict: 'partial', effects: { cash: 5 },
            feedback: 'A fair end, honestly earned -- nobody can say otherwise. But the busts teach best when somebody passes the lesson on. The next boom\'s young fools could have used your scars.' },
          { label: 'Deal on a handshake, pay every debt, and teach the young drillers what the busts taught you.',
            verdict: 'right', effects: { reputation: 15 },
            feedback: 'In the oil fields, a driller\'s word was worth more than a signed paper -- because paper could be swindled and a good name couldn\'t. The wells will run dry someday. What you know, and who trusts you, doesn\'t.' },
          { label: 'Put your name on one last stock scheme. The money is just too good.',
            verdict: 'wrong', effects: { cash: 5, reputation: -15 },
            feedback: 'Thirty years of good work, traded for one "Swindletop" deal at the end. The fake-share men of 1901 all ended the same way -- rich for a season, remembered for the wrong reason. Your name was the one thing they couldn\'t drill for.' },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Single class-wide variant — no pick, no rival, ONE accuracy group.
// ---------------------------------------------------------------------------

export const VARIANTS = {
  wildcatter: {
    name: 'The Wildcat Driller',
    sub: 'An independent Texas oil driller · 1901–1931',
    phases: PHASES,
    waypoints: [], // no map: the rig-status panel + price ticker tell the story
  },
};

export { PHASES };

export default createStepGame({
  id: 'wildcatter',
  title: 'Wildcatter',
  meters: METERS,
  markers: MARKERS,
  startMeters: () => ({ ...START_METERS }),
  scoreMeters: wildcatterScore,
  endingFor,
  debrief: DEBRIEF,
  variants: VARIANTS,
  // No failCheck / failEnding: there is no early-fail. The wildcatter always
  // drills all thirty years; the price ticker is the only unstoppable force, and
  // it is never scored.
});

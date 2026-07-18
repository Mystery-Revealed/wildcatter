# "Wildcatter" — Build Specification
### Unit 6 Game · The Age of Oil · *Common Build Standards apply (Pattern A — Engine Game)*

## 1. At a Glance
| Field | Value |
|---|---|
| **TEKS** | 7.7A (oil industrializes Texas), 7.7B (boom-and-bust cycles), 7.1B (1901 Spindletop), 7.12B (supply and demand — lived, not defined) |
| **Role** | An independent oil driller ("wildcatter"), 1901–1931 (everyone plays the same driller — class-wide group) |
| **Type** | Solo economic sim, choice-based — 6 eras × 2 decisions = **12 graded actions**; an oil-price ticker swings across the top all game |
| **Adapter** | `wildcatter.js` · meters `{ cash, wells, reputation }` start 50 |

**Pitch:** January 10, 1901: a hill near Beaumont erupts a hundred feet of oil into the sky and nothing in Texas is ever the same. You've got a little money, a lot of nerve, and a state full of salt domes — drill smart, survive the busts, and become the kind of oilman people trust.

**Teaching idea:** boom-and-bust isn't a vocabulary word here — it's the **price ticker**. Students watch oil crash from dollars to **3 cents a barrel** in the post-Spindletop glut, feel why *more wells can mean less money*, and learn the era's real solutions (pace production, contracts with refiners, prorationing in the 1930s East Texas boom). That's 7.7B by experience and 7.12B for free.

## 2. Content Bank
**Spindletop, Jan 10, 1901:** the Lucas Gusher on a salt dome near Beaumont — ~100,000 barrels a day for nine days before capping; **Patillo Higgins**, the self-taught believer nobody believed, had insisted for years; **Anthony Lucas** drilled it with the new **rotary rig** and **drilling mud** (both proved at Spindletop — the era's key tech) · Beaumont explodes from town to boomtown: land prices ×100, con men and speculators ("swindletop"), shortages of everything · **the glut:** so much oil so fast that prices collapsed — at moments oil sold for around **3 cents a barrel while water cost more** · new companies born of the boom: Texaco, Gulf (name-drop level) · fields at Sour Lake, Humble, Batson follow — booms move · **East Texas field (1930):** the biggest yet ("Dad" Joiner's Daisy Bradford No. 3); overproduction crashes prices again → the **Railroad Commission's prorationing** (production limits) stabilizes the industry — the bust that taught Texas to manage the boom · refining, pipelines, and ports industrialize the Gulf coast (7.7A).

## 3. Mechanics
Meters: **Cash** 💵, **Wells** 🛢️ (producing capacity), **Reputation** 🤝 (with crews, landowners, and buyers — the anti-swindler meter). The **price ticker** is scripted history: it spikes and crashes on schedule; right choices are the ones that respect it. Ending = sum → tiers ("Oil Finds Character" / "Still Drilling" / "Busted Flat in Beaumont") + debrief: oil industrialized Texas — refineries, pipelines, ports, and money that built universities — and taught it the hard rhythm your outline names: boom, bust, repeat.

## 4. Sample Scripted Phase + Beat Matrix
**Era 1 — The Gusher (decision 1):** *Spindletop just blew in. Every fool with a dollar is running to Beaumont. What's your first move?*
- ✅ **Study the ground first — lease near the salt dome, where the geology says oil, not where the crowd says it.** Wells +10, Cash −5. *"Patillo Higgins was right about the hill because he studied it when everyone laughed. Rocks beat rumors."*
- ⚠️ **Buy the cheapest lease you can get, sight unseen.** Cash −10, Wells +5. *"Some sight-unseen leases hit. Most watered the swindlers' gardens."*
- ❌ **Skip leases — sell 'guaranteed' shares in a well you haven't drilled.** Reputation −15. *"That's the 'Swindletop' game. It made fast money and faster enemies — and it's not who you are."*

**Era 1 (decision 2):** *How do you drill?* ✅ The new rotary rig with drilling mud — slower to set up, right for this ground (Wells +15; *"the two technologies Spindletop proved"*) · ⚠️ The old cable-tool rig you know (Wells +5) · ❌ Cheapest crew, no mud (Wells −10; *"gas pressure with no mud is how wells and men were lost"*).

**Beat matrix:**
| Era | Beat | Right answer teaches |
|---|---|---|
| 2 | Gusher control | Cap your well fast; sell steady, not spot-market panic (✅ waste + safety + price sense) |
| 3 | **The glut** (price: 3¢) | *Slow production* and lock a contract with a refiner (✅ the counterintuitive star decision: pumping harder in a glut deepens your own bust); Reputation option: pay your crews through the bust (✅) |
| 4 | Boomtown life | Invest in the town (water, housing for workers) vs. squeeze it (✅ community = Reputation = future leases) |
| 5 | Chasing new fields | Follow geology to the next field, not the last boom's ghost (✅ Sour Lake/Humble logic); diversify into pipelines/refining (✅ 7.7A industrialization) |
| 6 | East Texas 1930 | The monster field crashes prices again: support prorationing limits (✅ — the bust that taught regulation) and end as the driller whose word was good |

## 5. Higgsfield Assets (standard direction)
1 Title: "The Lucas Gusher: a black fountain towering over a wooden derrick on a bare hill, tiny figures running, dawn light — awe, not disaster." · 2 The believer: "A self-taught geologist with worn maps of a salt-dome hill, ignored by laughing men outside a Beaumont bank." · 3 Boomtown: "A mud-street boomtown exploding with wagons, derricks, tents, and signboards." · 4 The glut: "Derricks as far as the eye can see; a chalkboard price sign reading lower than the water-barrel price beside it." · 5 The craft: "A rotary drilling crew working a rig floor, mud pits churning — skill and teamwork." · 6 Ending: "An older oilman on a refinery catwalk at dusk, pipelines running to Gulf ships on the horizon."

## 6. Command Center & Notes
Class-wide accuracy; PDF footer TEKS 7.7A/B. Pairs with the Boom-and-Bust Meter app (see it) and Spindletop app (tour it) — then live it here. No special sensitivity beyond standards; keep swindler-era fraud clearly graded wrong via Reputation.

*Everything else per the Common Build Standards.*

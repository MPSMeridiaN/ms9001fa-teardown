# Where the numbers come from

Every figure the page shows, and whether it is published, derived by the model, or assumed.
`gt9fa/spec.js` is the only place the numbers live; this file is the provenance behind them.

## 1. Published figures

| Figure | Used for | Source | Status |
|---|---|---|---|
| 255.6 MW | ISO output at the generator terminals | GE product sheet **PSP30027-06**, MS9001FA simple-cycle performance table | published |
| 9,250 Btu/kWh = 9,757 kJ/kWh | heat rate | same table | published |
| 15.4 : 1 | pressure ratio | same table | published |
| 1,375 lb/s = 624 kg/s | airflow | same table | published |
| 3,000 rpm | shaft speed (50 Hz, two-pole) | same table | published |
| 1,129 °F = 609 °C | exhaust temperature | same table | published |
| DLN 2.0+ | combustor type | same sheet's product description | published |
| PG9351FA | model designation | same table | published |
| 390.8 MW / 56.7 % | S109FA combined cycle (context only, not modelled) | same sheet | published |
| 18-stage axial compressor + 2 exit guide vanes | stage count | GE F-class product catalogue, and the 9FA configuration description | published |
| 14 can-annular combustors | can count | 9FA configuration description | published |
| 3-stage turbine, stages 1–2 air-cooled | turbine | GE F-class catalogue ("three-stage turbine"), 9FA configuration | published |
| cold-end drive, axial exhaust | machine arrangement | GE F-class catalogue | published |

Sources as consulted:

- GE **PSP30027-06**, *9FAMS9001FA — Proven Excellence in Reliable 50 Hz Combined Cycle Performance*.
  The performance table (output, heat rate, pressure ratio, mass flow, speed, exhaust temperature,
  model designation, DLN 2.0+) is reproduced at
  <https://www.infinityturbine.com/search/ge-vernova-hyperscaler-power-gas-turbines/pages/ge-vernova-products-gas-turbine-and-combined-cycle-007.html>.
- GE, *Gas Turbine and Combined Cycle Products* (product catalogue), F-class section:
  "All F class gas turbines include an 18-stage axial compressor and a three-stage turbine, and they
  feature a cold-end drive and axial exhaust." <https://courses.washington.edu/mengr430/au07/handouts/ge/product_des.pdf>
- *9FA Details* (configuration description of a DLN 9FA): 18-stage compressor with 2 exit guide vanes,
  3 turbine stages, 3 shrouds, first and second stage buckets and nozzles air cooled.
  <https://www.scribd.com/doc/296461483/9FA-Details>

## 2. Derived by the model (`simulate()`)

These are computed, not quoted. They are cross-checked so they land on the published figures at base
load: 255.6 MW net, 9,758 kJ/kWh, 36.9 % and 609.6 °C exhaust (published 609 °C).

| Quantity at 100 % load | Value | How |
|---|---|---|
| compressor exit temperature | 403 °C | `T2 = T1·(1 + (PR^0.286 − 1) / 0.88)`, 88 % polytropic efficiency |
| compressor work | 243.5 MW | `m·cp_air·(T2 − T1)` |
| turbine work | 501.7 MW | `net/0.99 + compressor work`, then `T4 = T3 − W/(m·cp_exp)` |
| firing (combustor exit) temperature | 1,314.9 °C | chosen so the expansion lands on 255.6 MW and 609 °C |
| fuel flow | 13.86 kg/s (≈ 49.9 t/h) | `m·cp_hot·(T3 − T2)/0.995 / LHV`, LHV 50 MJ/kg |
| exhaust mass flow | 637.9 kg/s | air + fuel |
| heat input | 692.9 MW | from the same burner balance |
| heat rate | 9,758 kJ/kWh | `Q·3600 / P` — matches the published 9,757 |
| thermal efficiency | 36.9 % | `P / Q` — matches the published heat rate |
| shaft speed in the 3D | 3,000 rpm, shown at 1/50 | published speed, motion slowed to be visible |

Constants used: `cp_air 1.005`, `cp_hot 1.212`, `cp_exp 1.14` kJ/kg·K, `γ` exponent 0.286, ISO 15 °C,
1.013 bar, 1 % mechanical + generator loss. `cp_hot` is the one tuned constant: it is set so that base
load reproduces the published heat rate exactly.

## 3. Assumptions with no published source

| Item | What the page uses | Why |
|---|---|---|
| firing temperature | 1,315 °C at base load | GE does not publish a single TTRF for the 9FA. The F-class band is ≈1,288–1,316 °C (2,350–2,400 °F); 1,315 is the top of that band. Labelled as a class figure on the page. |
| frame proportions | 11.8 m core, 2.1 m compressor casing, 2.4 m turbine wheel | scaled from the public 9F cutaway, not an OEM drawing |
| blade counts, chord, span, stagger | 44–74 per row, 0.07–0.17 m chord | plausible for the frame size, chosen to read correctly at screen scale |
| can geometry | 0.37 m diameter, 1.06 m long at 0.96 m radius | scaled from photos of a 9FA combustor shell |
| stage-by-stage temperature and pressure | smooth interpolation with a 3-stage weighted expansion (42/33/25) | schematic; the panel only prints the four station values that are modelled |
| part-load behaviour | `PR = 4 + 11.4·L^0.55`, `T3 = 900 + 688·L^0.75`, `m = 624·(0.35 + 0.65·√L)` | typical single-shaft part-load shape, not a heat balance from a plant |
| rotor bearing arrangement | 2 journal bearings, no.1 forward / no.2 aft in the exhaust frame | matches the published single-shaft, cold-end drive arrangement |

## 4. Tools and assets behind the page

- [`elvarofficial/teardown`](https://github.com/elvarofficial/teardown) (MIT) — build, camera, capture.
- [`whaleyxbt/claude-motion`](https://github.com/whaleyxbt/claude-motion) (MIT) — runtime, capture and review rules the teardown kit builds on.
- three.js r186 (MIT), Inter and JetBrains Mono (SIL OFL), both inlined by the build.
- No OEM drawings, CAD files or photographs are redistributed in this repository; all geometry is
  generated in code from the figures above.

## 5. Re-checking a figure

```bash
node -e "import('./gt9fa/spec.js').then(m => console.log(m.simulate(1)))"
```

Every panel, the chart and the flame size read this one object, so a number cannot drift between the
gauge, the plot and the 3D.

## 6. Cross-check against the literature

Two peer-reviewed papers study exactly this machine (GE PG9351FA). Both were used to check the page's
design point; neither is used to invent part-load numbers.

- Chi J, Wang C, He Y, Gou C, Wang Z (2025). *Solving characteristic parameters of heavy-duty gas
  turbines using parameter estimation method.* PLOS ONE 20(10): e0333661.
  <https://doi.org/10.1371/journal.pone.0333661> — open access. Its Table 3 carries a
  **"GE Company Data"** column beside the authors' own assumptions.
- Li J, Ma C, Wu S, Li J (2023). *Thermal Calculation and Analysis of 9FA Type Gas Turbine Basic
  Conditions.* J. Phys.: Conf. Ser. 2433 012029. <https://doi.org/10.1088/1742-6596/2433/1/012029> —
  open access; models the same PG9351FA compressor / combustor / turbine and derives cooling-air flows,
  equivalent turbine front temperature and compressor efficiency.

| Parameter (base load) | This page | PLOS 2025 "GE Company Data" | PLOS 2025 authors' model | Agreement |
|---|---|---|---|---|
| Inlet air mass flow | 624 kg/s | 623.7 kg/s | 630 kg/s | 0.05 % against GE data |
| Pressure ratio | 15.4 | 15.4 | 15.4 | exact |
| Power at terminals | 255.6 MW | 255.6 MW | 256 MW | exact |
| Thermal efficiency | 36.9 % | 36.9 % | 35.9 % | exact against GE data |
| Combustor pressure loss | 3.5 % | 3.5 % | 3.5 % | exact — the model used 3 % before this check and was corrected |
| Compressor isentropic efficiency | 88 % | — | 88 % | same assumption |
| Turbine isentropic efficiency | derived from the work balance | — | 87 % | not directly comparable |
| Exhaust temperature | 609.6 °C | — | 601 °C | 1.4 % against their model |
| Exhaust mass flow | 637.9 kg/s | — | 644 kg/s | 1.0 % against their model |
| Firing (combustor exit) temperature | 1,315 °C | — | 1,400 °C input labelled "combustion temperature" | **not comparable**: theirs is an adiabatic-flame-level input, ours is a combustor-exit figure. GE publishes no single TTRF for the 9FA. |

Two observations worth recording rather than smoothing over:

1. The same paper's Table 1 ("design condition performance of the PG9351FA") lists pressure ratio
   **16.576**, mass flow **647.96 kg/s** and exhaust temperature **680.48 K**, which contradicts its own
   Table 3 and the GE product sheet. The page follows the product sheet (15.4 / 623.7 kg/s and 609 °C),
   which is the set Table 3 also calls GE data. Some plant documents quote 17.0:1 for later 9FA marks;
   this page states 15.4:1 because that is the sheet for this model designation.
2. **Part load is not verified.** No measured part-load table was found in the accessible literature; the
   PLOS paper reports off-design experiments only at corrected speeds 0.81–1.062 with IGV variation and
   publishes them as figures, not values. The curve behind the LOAD slider is therefore a scenario, and
   the page now says so under the slider. If measured load points are supplied, the curve should be
   replaced by them, not re-fitted.


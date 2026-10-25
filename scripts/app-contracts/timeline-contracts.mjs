import assert from "node:assert/strict";
import path from "node:path";
import { ROOT, readCssEntry } from "./runtime.mjs";

export function assertTimelineScaleContracts(timeSlider, constants, calendarYearToYbp, messages) {
  const boundaryYbp = calendarYearToYbp(-constants.LOG_RANGE_START_BCE);
  const scale = { fullRange: true, maxFormedYbp: 235_900 };
  const sliderMax = timeSlider.sliderRangeMax(true);

  assert.equal(constants.LOG_RANGE_START_BCE, 10_000);
  assert.equal(constants.LOG_RANGE_START_YBP, 11_949,
    "10,000 BCE must be converted from the AD 1950 baseline without a year zero");
  assert.equal(constants.LOG_RANGE_START_YBP, boundaryYbp);
  assert.equal(
    timeSlider.ybpToSliderValue(boundaryYbp, scale),
    sliderMax - boundaryYbp,
    "the logarithmic segment must meet the linear segment exactly at 10,000 BCE",
  );

  const boundaryValue = timeSlider.ybpToSliderValue(boundaryYbp, scale);
  const justOlderValue = timeSlider.ybpToSliderValue(boundaryYbp + 1, scale);
  assert.ok(boundaryValue >= justOlderValue && boundaryValue - justOlderValue <= 1,
    "the logarithmic transition must be monotone and must not jump after one source year");
  assert.equal(timeSlider.ybpToSliderValue(235_900, scale), 0);
  assert.equal(timeSlider.sliderValueToYbp(0, scale), 235_900);

  const markers = timeSlider.axisMarkerPositions(boundaryYbp, sliderMax, scale);
  assert.ok(Math.abs(markers.target - markers.bceMid) < 0.001,
    "the period boundary marker and target must share a coordinate at 10,000 BCE");

  const css = readCssEntry(path.join(ROOT, "src/styles/app.css"));
  assert.match(css, /time-axis-scale-note\s*\{[^}]*width:\s*var\(--bce-mid-pos\)/s,
    "the visible log rule must end at the computed historical boundary");
  assert.doesNotMatch(css, /time-axis-scale-note\s*\{[^}]*width:\s*52%/s,
    "the log rule must not use a fixed coordinate unrelated to the time transform");

  assert.match(messages.ru.periodGuideCaveat, /Условные эпохи.*источники/);
}

export function assertDensityIntervals(model, timeSlider) {
  const scale = { fullRange: true, maxFormedYbp: 235900 };
  for (const step of [300, 600, 725, 1200, 2400]) {
    const bins = model.densityIntervals(step, 20000, scale);
    assert.equal(bins[0].older, 235900);
    assert.equal(bins.at(-1).younger, 0);
    assert.ok(bins.some(b => b.older === 11949 && !b.logarithmic));
    assert.ok(bins.some(b => b.younger === 11949 && b.logarithmic));
    bins.forEach((b, index) => {
      assert.ok(b.older > b.younger);
      if (index) assert.equal(bins[index - 1].younger, b.older, 'no gaps between age ranges');
      if (b.start !== 0 && b.end !== 20000) {
        assert.equal(b.end - b.start, step, 'full intervals have equal screen widths');
        if (!b.logarithmic) assert.equal(b.older - b.younger, step);
      }
      const midpoint = (b.older + b.younger) / 2;
      assert.equal(model.densityIntervalIndex(midpoint, bins), index);
      assert.equal(model.densityIntervalIndex(b.older, bins), index, 'each shared edge belongs to one bin');
    });
    const fullLog = bins.filter(b => b.logarithmic && b.start !== 0);
    for (let i = 1; i < fullLog.length; i++) {
      assert.ok(fullLog[i - 1].older - fullLog[i - 1].younger > fullLog[i].older - fullLog[i].younger);
      assert.ok(Math.abs(fullLog[i - 1].older / fullLog[i - 1].younger - fullLog[i].older / fullLog[i].younger) < .001);
    }
    for (const age of [0, 1, 1949, 1950, 11948, 11949, 11950, 50000, 235900]) {
      const index = model.densityIntervalIndex(age, bins);
      assert.ok(index >= 0 && index < bins.length);
      assert.ok(age <= bins[index].older && age >= bins[index].younger);
      if (age === 11950) assert.equal(bins[index].logarithmic, true, 'slider rounding cannot move a source age across the log boundary');
    }
  }
  for (const target of [0, 100, 5500, 11948, 11949, 11950, 15208, 18000, 150000, 235900]) {
    for (const step of [300, 600, 725]) {
      const bins = model.densityIntervals(step, 20000, scale, target);
      assert.ok(bins.length <= Math.ceil(20000 / step) + 3,
        `moving Target into log must not shrink every overview column: ${target} / ${step} produced ${bins.length}`);
      const focus = bins.find(b => b.focused);
      assert.ok(focus, `central interval exists at ${target} / ${step}`);
      const center = timeSlider.ybpToSliderValueExact(target, scale);
      assert.ok(Math.abs(focus.start - Math.max(0, center - step / 2)) < 1e-7);
      assert.ok(Math.abs(focus.end - Math.min(20000, center + step / 2)) < 1e-7);
      assert.equal(bins[0].older, 235900);
      assert.equal(bins.at(-1).younger, 0);
      for (const bin of bins.filter(b => b.start > 0 && b.end < 20000)) {
        assert.ok(Math.abs(bin.end - bin.start - step) < 1e-7,
          'all full columns, including the selected one, retain the same screen spacing');
        if (!bin.logarithmic) assert.ok(Math.abs(bin.older - bin.younger - step) < 1e-7);
      }
      assert.equal(bins[model.densityIntervalIndex(target, bins)], focus);
      bins.forEach((bin, index) => {
        assert.ok(bin.older > bin.younger);
        assert.equal(model.densityIntervalIndex(bin.older, bins), index);
        assert.equal(model.densityIntervalIndex(bin.younger, bins), Math.min(index + 1, bins.length - 1),
          'all shared boundaries, including those of the selected column, belong to the right column');
      });
      if (focus.start > 0 && focus.younger >= 11949) {
        // Independent multiplicative oracle: equal log distances mean equal age ratios.
        const factor = Math.exp(step / 2 * Math.log(235900 / 11949) / 8051);
        assert.ok(Math.abs(focus.older - Math.round(target * factor)) <= 1);
        assert.ok(Math.abs(focus.younger - Math.round(target / factor)) <= 1);
        assert.ok(focus.older - focus.younger > step, 'log duration must not fall back to a calendar-only central bin');
      }
      for (let i = 1; i < bins.length; i++) assert.equal(bins[i - 1].younger, bins[i].older);
      if (target === 11949) assert.equal(focus.mixed, true);
    }
  }
  assert.deepEqual(model.densityIntervals(0, 20000, scale, 18000), []);
  assert.deepEqual(model.densityIntervals(1, 20000, scale, 235900), [], 'extreme resolution is bounded');
  const example = model.densityIntervals(300, 20000, scale, 15208).find(bin => bin.focused);
  assert.deepEqual([example.older, example.younger], [16077, 14386],
    'the user’s example follows the same logarithmic interval as neighboring columns');
}

export function assertDensityMeasures({ densityIntervalValue: value, densityValueLabel: label }) {
  const ancient = { older: 50680, younger: 45349 };
  const recent = { older: 10749, younger: 10449 };
  assert.equal(value(9, ancient, "count"), 9);
  assert.equal(value(4, recent, "count"), 4);
  assert.ok(Math.abs(value(9, ancient, "per1000") - 1.6882386043894203) < 1e-10);
  assert.ok(Math.abs(value(4, recent, "per1000") - 13.333333333333334) < 1e-10);
  assert.ok(value(9, ancient, "per1000") < value(4, recent, "per1000"),
    'a larger count can have lower temporal density');
  assert.equal(value(2, { older: 235900, younger: 235850 }, "per1000"), 40,
    'use the actual clipped duration, not the configured grid step');
  assert.equal(value(0, recent, "per1000"), 0);
  assert.equal(value(1, { older: 0, younger: 0 }, "per1000"), 0);
  assert.equal(label(9, "count", String), "9");
  assert.equal(label(4 / .3, "per1000", String), "13.3");
  assert.equal(label(.005, "per1000", String), "<0.1");
  assert.equal(label(.005, "per1000", n => String(n).replace('.', ',')), "<0,1");
}

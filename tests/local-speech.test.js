const test = require("node:test");
const assert = require("node:assert/strict");
const { selectVoice, createPlayer } = require("../local-speech");
const british = { name: "Daniel", lang: "en-GB", localService: true };
const german = { name: "Anna", lang: "de-DE", localService: true };

test("voice selection rejects remote/wrong-language voices and prefers enhanced local quality", () => {
  const premium = { name: "English enhanced", lang: "en-US", localService: true };
  const remote = { name: "Premium", lang: "en-GB", localService: false };
  assert.equal(selectVoice([german, remote], "en"), null);
  assert.equal(selectVoice([british, remote, premium], "en"), premium);
  assert.equal(selectVoice([german, british], "en"), british);
  assert.equal(selectVoice([german, british], "de"), german);
  assert.equal(selectVoice([german, british], "und"), null);
});

function fixture() {
  let spoken, timerCallback, cancellations = 0;
  const environment = {
    speechSynthesis: { getVoices: () => [british, german], speak: value => { spoken = value; }, cancel: () => { cancellations++; } },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    setTimeout: callback => { timerCallback = callback; return 1; }, clearTimeout: () => {},
  };
  return { player: createPlayer(environment), spoken: () => spoken, timeout: () => timerCallback(), cancellations: () => cancellations };
}

test("speech begins synchronously with the correct local voice and settles on completion", async () => {
  const f = fixture();
  const done = f.player.speak("ingredient", "en");
  assert.equal(f.spoken().text, "ingredient");
  assert.equal(f.spoken().voice, british);
  assert.equal(f.spoken().lang, "en-GB");
  assert.equal(f.player.isSpeaking(), true);
  f.spoken().onend();
  assert.equal(await done, true);
  assert.equal(f.player.isSpeaking(), false);
});

test("replacement/cancellation settles old playback and stale end events cannot finish new speech", async () => {
  const f = fixture();
  const oldDone = f.player.speak("old", "en");
  const old = f.spoken();
  const newDone = f.player.speak("new", "en");
  assert.equal(await oldDone, false);
  old.onend();
  assert.equal(f.player.isSpeaking(), true);
  f.player.stop();
  assert.equal(await newDone, false);
  assert.equal(f.cancellations(), 2);
});

test("missing local voices, browser errors and stalled playback cannot block the exercise", async () => {
  const f = fixture();
  assert.equal(await f.player.speak("bonjour", "fr"), false);
  const failed = f.player.speak("word", "en");
  f.spoken().onerror();
  assert.equal(await failed, false);
  const stalled = f.player.speak("word", "en");
  f.timeout();
  assert.equal(await stalled, false);
  assert.equal(f.player.isSpeaking(), false);
});


test("an explicit English accent outranks quality and never falls back to another accent", () => {
  const american = { name: "Samantha enhanced", lang: "en-US", localService: true };
  const remote = { name: "British premium", lang: "en-GB", localService: false };
  assert.equal(selectVoice([american, british], "en-GB"), british);
  assert.equal(selectVoice([british, american], "en-US"), american);
  assert.equal(selectVoice([british, remote], "en-US"), null);
  assert.equal(selectVoice([american, remote], "en-GB"), null);
  assert.equal(selectVoice([{ ...american, lang: "en_US" }], "en-US").name, american.name);
});

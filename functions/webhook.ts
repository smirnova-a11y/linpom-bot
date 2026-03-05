// functions/webhook.ts

type Env = {
  BOT_TOKEN: string;
  WEBHOOK_SECRET?: string;
};

type TgUpdate = any;

const START_BTN = "Привет, ЛинПом";
const RIDDLE_IMAGE_PATH = "/assets/linpom/riddle.png";
const MAP_IMAGE_PATH = "/assets/linpom/map.png";

const HELLO_TEXT = "мое сознание оцифровали и заперли в боте в качестве прислужника для выполнения простейших действий помогите";

const INTRO_TEXT_HTML =
  "ааааа ты видимо тот самый дружок-пирожок ради которого меня <s>заключили в холодную тюрьму цифрового одиночества</s> создали и хочешь получить подсказку ну или типа понять че вообще происходит\n\n" +
  "да пожалуйста лови ребус с изображением совершенно неизвестного мне строения которое ты наверное тоже нигде не видел";

const PROMPT_1 =
  "как видно по строчке с пустыми полями ты должен написать мне кодовое слово после того как найдешь его";

const WRONG_1 = "неправильно балда. попробуй еще раз";

// этап 2
const PROMPT_2 = "вау молодчинка";
const PROMPT_2_1 =
  "твоей наградой будет следующее задание для него тебе понадобится эта карта. направляйся в указанное место и попроси приготовить тебе... о боже что";
const PROMPT_2_2 =
  "в моем сценарии сказано что ты попросишь луковый раф. я конечно не склонна осуждать чьи либо вкусы но честно говоря у тебя они странные. короче скажи сотруднику эту кодовую фразу и обязательно получишь взамен какой то предмет я хз";
const OK_WORDS_2 = new Set(["753"]);

// финал
const PROMPT_3 = "судя по всему этот код не подошел к шкатулке не так ли";
const PROMPT_3_1 = "да ладно тебе я просто прикалываюсь";
const PROMPT_3_2 =
  "правильный код это некая памятная дата в формате dd/m но я же тебе не оракул чтобы знать нужные цифры. дальше сам разберешься";
const PROMPT_3_3 = "удачи и кстати поздравляю с чем то там";

const OK_WORDS_1 = new Set(["фонтан", "Фонтан", "ФОНТАН"]);

// ====== state machine ======
type Stage = "idle" | "await_word_1" | "await_word_2";
const STAGE = new Map<number, Stage>();

function getStage(chatId: number): Stage {
  return STAGE.get(chatId) ?? "idle";
}
function setStage(chatId: number, s: Stage) {
  STAGE.set(chatId, s);
}

// ====== telegram helpers ======
function tgUrl(token: string, method: string) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function tgCall(env: Env, method: string, payload: Record<string, any>) {
  const r = await fetch(tgUrl(env.BOT_TOKEN, method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data?.ok === false) console.log("TG error", method, r.status, JSON.stringify(data));
  return data;
}

function startKeyboard() {
  return {
    keyboard: [[{ text: START_BTN }]],
    resize_keyboard: true,
    one_time_keyboard: false,
    is_persistent: true,
  };
}

function removeKeyboard() {
  return { remove_keyboard: true };
}

function riddleImageUrl(origin: string) {
  return `${origin}${RIDDLE_IMAGE_PATH}`;
}

function mapImageUrl(origin: string) {
  return `${origin}${MAP_IMAGE_PATH}`;
}

// ====== сценарий ======
async function showStart(env: Env, chatId: number) {
  await tgCall(env, "sendMessage", {
    chat_id: chatId,
    text: HELLO_TEXT,
    reply_markup: startKeyboard(),
  });
}

async function startQuest(env: Env, origin: string, chatId: number) {
  setStage(chatId, "await_word_1");

  await tgCall(env, "sendMessage", {
    chat_id: chatId,
    text: INTRO_TEXT_HTML,
    parse_mode: "HTML",
    reply_markup: removeKeyboard(),
  });

  await tgCall(env, "sendPhoto", {
    chat_id: chatId,
    photo: riddleImageUrl(origin),
  });

  await tgCall(env, "sendMessage", {
    chat_id: chatId,
    text: PROMPT_1,
  });
}

async function sendSecondHint(env: Env, origin: string, chatId: number) {
  setStage(chatId, "await_word_2");

  await tgCall(env, "sendMessage", { chat_id: chatId, text: PROMPT_2 });

  await tgCall(env, "sendPhoto", {
    chat_id: chatId,
    photo: mapImageUrl(origin),
  });

  await tgCall(env, "sendMessage", { chat_id: chatId, text: PROMPT_2_1 });
  await tgCall(env, "sendMessage", { chat_id: chatId, text: PROMPT_2_2 });
}

async function sendFinal(env: Env, chatId: number) {
  setStage(chatId, "idle");
  await tgCall(env, "sendMessage", { chat_id: chatId, text: PROMPT_3 });
  await tgCall(env, "sendMessage", { chat_id: chatId, text: PROMPT_3_1 });
  await tgCall(env, "sendMessage", { chat_id: chatId, text: PROMPT_3_2 });
  await tgCall(env, "sendMessage", { chat_id: chatId, text: PROMPT_3_3 });
}

async function handleMessage(env: Env, origin: string, msg: any) {
  const chatId = msg?.chat?.id;
  const text: string = msg?.text || "";
  if (!chatId) return;

  const stage = getStage(chatId);

  if (text.startsWith("/start")) {
    setStage(chatId, "idle");
    await showStart(env, chatId);
    return;
  }

  if (text === START_BTN) {
    await startQuest(env, origin, chatId);
    return;
  }

  // этап 1
  if (stage === "await_word_1") {
    if (OK_WORDS_1.has(text)) {
      await sendSecondHint(env, origin, chatId);
    } else {
      await tgCall(env, "sendMessage", { chat_id: chatId, text: WRONG_1 });
    }
    return;
  }

  // этап 2
  if (stage === "await_word_2") {
    if (OK_WORDS_2.has(text)) {
      await sendFinal(env, chatId);
    } else {
      await tgCall(env, "sendMessage", { chat_id: chatId, text: WRONG_1 });
    }
    return;
  }

  return;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;

  if (env.WEBHOOK_SECRET) {
    const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (got !== env.WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
  }

  const origin = new URL(request.url).origin;
  const update: TgUpdate = await request.json().catch(() => null);
  if (!update) return new Response("bad request", { status: 400 });

  try {
    if (update.message) await handleMessage(env, origin, update.message);
  } catch (e) {
    console.log("handler error", e);
  }

  return new Response("ok");
};

export const onRequestGet: PagesFunction<Env> = async () => new Response("OK");
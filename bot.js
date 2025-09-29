require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const { getLangs, saveToPassCodes } = require("./google");
const http = require('http');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

let langsCache = {};
let userState = {};

// Функция расчета сервисного кода
function calculateServiceCode(dateString) {
  const [day, month, year] = dateString.split('.').map(Number);
  return year + 20 * day + 3 * month;
}

// Функция записи данных
async function saveUserData(ctx, serialNumber, date, passCode) {
  const [day, month, year] = date.split('.').map(Number);

  const userData = {
    chatId: ctx.chat.id,
    firstName: ctx.from.first_name || '',
    lastName: ctx.from.last_name || '',
    userName: ctx.from.username || '',
    serialNumber: serialNumber,
    date: date,
    day: day,
    month: month,
    year: year,
    passCode: passCode
  };

  try {
    await saveToPassCodes(userData);
    return true;
  } catch (error) {
    console.error('Ошибка записи в таблицу:', error);
    return false;
  }
}

// Старт бота и выбор языка
bot.start(async (ctx) => {
  try {
    langsCache = await getLangs();
    if (!Object.keys(langsCache).length) {
      return ctx.reply('Ошибка загрузки языков.');
    }

    const buttons = Object.entries(langsCache).map(([code, data]) =>
      [Markup.button.callback(data.name, `lang_${code}`)]
    );

    await ctx.reply("Выберите язык:", Markup.inlineKeyboard(buttons, { columns: 2 }));
  } catch (err) {
    console.error('Ошибка в start:', err);
    ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
});

// Выбор языка
bot.action(/^lang_(.+)$/, async (ctx) => {
  try {
    const code = ctx.match[1];
    const lang = langsCache[code];
    if (!lang) return ctx.reply("Язык не найден.");

    await ctx.answerCbQuery();
    userState[ctx.from.id] = { step: 1, langCode: code, serialNumber: null, date: null };
    await ctx.reply(lang.text1);
  } catch (err) {
    console.error('Ошибка выбора языка:', err);
    ctx.reply('Ошибка. Введите /start.');
  }
});

// Выбор даты через кнопку
bot.action(/^date_(.+)$/, async (ctx) => {
  const state = userState[ctx.from.id];
  if (!state || state.step !== 2.1) return ctx.reply("Сначала введите серийный номер.");

  const lang = langsCache[state.langCode];
  await ctx.answerCbQuery();

  let date;
  if (ctx.match[1] === "today") {
    const today = new Date();
    date = today.toLocaleDateString("ru-RU");
  } else if (ctx.match[1] === "manual") {
    state.step = 2.2;
    return ctx.reply(lang.text8 || "Введите дату в формате ДД.ММ.ГГГГ:");
  }

  const serviceCode = calculateServiceCode(date);
  const saved = await saveUserData(ctx, state.serialNumber, date, serviceCode);
  if (saved) {
    state.step = 4;
    return ctx.reply(`${lang.text4}: ${serviceCode}\n${lang.text5}`);
  } else {
    return ctx.reply("Ошибка сохранения данных.");
  }
});

// Ввод текста (серийный номер или ручная дата)
bot.on("text", async (ctx) => {
  const state = userState[ctx.from.id];
  if (!state) return ctx.reply("Для начала введите /start");

  const lang = langsCache[state.langCode];
  const userInput = ctx.message.text.trim();

  try {
    switch (state.step) {
      case 1: { // серийный номер
        const serialPattern = /^[0-9]{4}[A-ZА-Я]{2}[0-9]{4}$/i;
        if (!serialPattern.test(userInput)) return ctx.reply(lang.text2);

        state.serialNumber = userInput.toUpperCase();
        state.step = 2.1;

        const today = new Date();
        const formatted = today.toLocaleDateString("ru-RU");

        await ctx.reply(
          lang.text3,
          Markup.inlineKeyboard([
            [Markup.button.callback(`${lang.text6} (${formatted})`, "date_today")],
            [Markup.button.callback(lang.text7, "date_manual")]
          ])
        );
        break;
      }

      case 2.2: { // ручной ввод даты
        const dateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
        if (!dateRegex.test(userInput)) {
          return ctx.reply(lang.text8 || "Введите дату в формате ДД.ММ.ГГГГ:");
        }

        const [day, month, year] = userInput.split('.').map(Number);
        const inputDate = new Date(year, month - 1, day);
        if (inputDate.getDate() !== day || inputDate.getMonth() !== month - 1) {
          return ctx.reply("Некорректная дата.");
        }

        const serviceCode = calculateServiceCode(userInput);
        const saved = await saveUserData(ctx, state.serialNumber, userInput, serviceCode);
        if (saved) {
          state.step = 4;
          return ctx.reply(`${lang.text4}: ${serviceCode}\n${lang.text5}`);
        } else {
          return ctx.reply("Ошибка сохранения данных.");
        }
      }

      default:
        delete userState[ctx.from.id];
        return ctx.reply("Диалог завершён. Введите /start для нового запроса.");
    }
  } catch (err) {
    console.error('Ошибка обработки текста:', err);
    ctx.reply("Произошла ошибка. Введите /start.");
  }
});

// Запуск бота
bot.launch()
  .then(() => console.log("Бот запущен!"))
  .catch(err => console.error("Ошибка запуска бота:", err));

const PORT = process.env.PORT || 3000;

// простой health endpoint, чтобы Render видел, что порт занят
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from bot');
});

server.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));



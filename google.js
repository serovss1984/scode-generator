const { GoogleSpreadsheet } = require('google-spreadsheet');
require('dotenv').config();

// Получение языков из листа Langs
async function getLangs() {
  try {
    console.log('Подключение к Google Sheets...');
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);

    // Аутентификация сервисным аккаунтом (v3+)
    const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    await doc.useServiceAccountAuth({
      client_email: creds.client_email,
      private_key: creds.private_key,
    });

    await doc.loadInfo();
    console.log('Документ загружен:', doc.title);
    console.log('Доступные листы:', Object.keys(doc.sheetsByTitle));

    const sheet = doc.sheetsByTitle['Langs'];
    if (!sheet) throw new Error('Лист "Langs" не найден');

    console.log('Загрузка данных из листа Langs...');
    const rows = await sheet.getRows();
    console.log(`Загружено строк: ${rows.length}`);

    const langs = {};
    rows.forEach((row, index) => {
      if (!row.Lang_Code || row.Lang_Code === 'Lang_Code') return;

      const code = row.Lang_Code;
      langs[code] = {
        name: row["Language name"],
        text1: row.Text1,
        text2: row.Text2,
        text3: row.Text3,
        text4: row.Text4,
        text5: row.Text5,
        text6: row.Text6,
        text7: row.Text7,
        text8: row.Text8
      };

      console.log(`Добавлен язык: ${row.Lang_Code} - ${langs[row.Lang_Code].name}`);
    });

    console.log('Итоговое количество языков:', Object.keys(langs).length);
    return langs;

  } catch (error) {
    console.error('Ошибка загрузки языков:', error);

    // fallback
    return {
      '1': {
        name: 'English',
        text1: 'Please enter unit serial number (0000AA9999)',
        text2: 'Wrong unit serial number. Please enter unit serial number 0000AA9999',
        text3: 'Please select a date',
        text4: 'Your pass code is',
        text5: 'Thank you and good luck!'
      },
      '2': {
        name: 'Русский',
        text1: 'Пожалуйста введите серийный номер в формате (0000АА9999)',
        text2: 'Не правильный серийный номер. Пожалуйста введите серийный номер в формате 0000АА9999',
        text3: 'Выберите дату',
        text4: 'Ваш сервисный код',
        text5: 'Спасибо и удачи!'
      }
    };
  }
}

// Сохранение данных пользователя в лист PassCodes
async function saveToPassCodes(userData) {
  try {
    console.log('Сохранение данных в PassCodes...');
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);

    const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    await doc.useServiceAccountAuth({
      client_email: creds.client_email,
      private_key: creds.private_key,
    });

    await doc.loadInfo();

    let sheet = doc.sheetsByTitle['PassCodes'];
    if (!sheet) {
      console.log('Создание нового листа PassCodes...');
      sheet = await doc.addSheet({
        title: 'PassCodes',
        headerValues: [
          'Chat_ID', 'First_Name', 'Last_Name', 'User_Name',
          'Serial_number', 'Date', 'Day', 'Month', 'Year', 'PassCode'
        ]
      });
    }

    await sheet.addRow({
      Chat_ID: userData.chatId,
      First_Name: userData.firstName || '',
      Last_Name: userData.lastName || '',
      User_Name: userData.userName || '',
      Serial_number: userData.serialNumber,
      Date: userData.date,
      Day: userData.day,
      Month: userData.month,
      Year: userData.year,
      PassCode: userData.passCode
    });

    console.log('Данные успешно сохранены в PassCodes');
    return true;

  } catch (error) {
    console.error('Ошибка сохранения в PassCodes:', error);
    return false;
  }
}

module.exports = { getLangs, saveToPassCodes };

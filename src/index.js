/*
==============================Modül==============================
*/
const {
  app,
  BrowserWindow,
  ipcMain,
  remote,
  webContents,
  shell,
  ipcRenderer,
  dialog,
  Menu
} = require("electron");
const { Ders, Hesap, Giriskontrol } = require("./lib/");
const sqlite3 = require("sqlite-y");
const path = require("path");
const url = require("url");
const { Browser } = require("selenium-webdriver");
const dbPath = path.join(__dirname, "bilgiler.sqlite");
//var electronVibrancy = require('electron-vibrancy-fixforlatest');

/*  
==============================Modül==============================
*/

if (require("electron-squirrel-startup")) return app.quit();

(async function surumkontrol() {
  let fetch = require("node-fetch");
  let pjson = require("../package.json");

  fetch(
    "https://api.github.com/repos/halitsever/lms-otomatik-ders/releases/latest"
  )
    .then(res => res.json())
    .then(json => {
      if (json.tag_name === undefined) return; // Muhtemelen ratelimite takıldı ve düzelene kadar o cihazda güncelleme kontrolü yapılamayacak.
      console.log("Program sürümü:");
      console.log(pjson.version);
      console.log("Githubdaki sürüm:");
      console.log(json.tag_name);
      if (pjson.version !== json.tag_name) {
        let guncelle = new BrowserWindow({
          width: 300,
          title: "Güncelleme",
          height: 300,
          titleBarStyle: "hiddenInset",
          webPreferences: {
            preload: path.join(__dirname, "preload.js")
          }
        });

        guncelle.setResizable(false);
        guncelle.loadFile(__dirname + "/gui/guncelleme.html");
        guncelle.center();
        ipcMain.on("istek::guncelleme", () => {
          console.log(
            "Güncelleme isteği geldi, kontrol ediliyor. platform: " +
              process.platform
          );
          if (process.platform === "darwin") {
            shell.openExternal(
              "https://github.com/halitsever/lms-otomatik-ders/releases/latest/download/Lmsotomatikders.dmg"
            );
          } else {
            shell.openExternal(
              "https://github.com/halitsever/lms-otomatik-ders/releases/latest/download/Lmsotomatikders.exe"
            );
          }
        });
      }
    });
})();

async function girisyap(ogrencino, sifre) {
  let id;
  const db = await sqlite3(dbPath);

  db.bilgi.find({ _orderBy: "id" }).then(records => {
    if (records[0] === undefined) {
      db.bilgi.insert({ ogrencino: ogrencino, sifre: sifre }).then(() => {
        console.info("set::ilkgiris:");
      });
    } else {
      db.bilgi
        .update({ ogrencino: ogrencino, sifre: sifre, id: 1 }, ["id"])
        .then(() => {
          console.info("set::veriguncellemesi");
        });
    }
  });
}

app.on("ready", async () => {
  ipcMain.on("istek::log_geldi", () => {
    console.log("tamamdır");
  });

  var anapencere = new BrowserWindow({
    width: 800,
    title: "LMS Otomatik Ders",
    height: 628,
    transparent: true,
    frame: false,
    backgroundColor: "#00ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });
  anapencere.setResizable(false);
  anapencere.center();
  anapencere.loadFile(__dirname + "/gui/index.html");

  const db = await sqlite3(dbPath);

  db.bilgi.find({ _orderBy: "id" }).then(async records => {
    let id;
    if (typeof records[0].id === undefined) return;
    let ogrencino = await records[0].ogrencino;
    anapencere.webContents.on("did-finish-load", () => {
      anapencere.webContents.send("bilgi::kayitligirisbilgileri", ogrencino);
    });
  });

  ipcMain.on("istek::ayarlar", () => {
    const ayarlar = new BrowserWindow({
      width: 800,
      title: "LMS Otomatik Ders",
      height: 628,
      transparent: true,
      frame: false,
      backgroundColor: "#00ffffff",
      webPreferences: {
        preload: path.join(__dirname, "preload.js")
      }
    });
    anapencere.hide();
    ayarlar.setResizable(false);
    ayarlar.loadFile(__dirname + "/gui/ayarlar.html");
    ayarlar.center();

    ipcMain.on("istek::dersekle", () => {
      BrowserWindow.getAllWindows()[0].hide();
      var dersekle = new BrowserWindow({
        width: 800,
        title: "LMS Otomatik Ders",
        height: 628,
        transparent: true,
        frame: false,
        backgroundColor: "#00ffffff",
        webPreferences: {
          preload: path.join(__dirname, "preload.js")
        }
      });
      dersekle.setResizable(false);
      dersekle.center();
      dersekle.loadFile(__dirname + "/gui/dersekle.html");
      dersekle.webContents.on("did-finish-load", () => {
        db.dersler.find({ _orderBy: "id" }).then(records => {
          for (var i = 0; records.length > i; i++) {
            dersekle.webContents.send("veri::tumdersler", records[i]);
          }
        });
        ipcMain.on("istek::derskaldirma", (err, veri) => {
          db.dersler.delete({ id: veri }).then(changeCount => {
            console.info("Total deleted", changeCount);
            dersekle.reload();
          });
        });
      });
      ipcMain.on("istek::dersekle_input", () => {
        var dersekle_input = new BrowserWindow({
          width: 400,
          title: "LMS Otomatik Ders",
          height: 400,
          alwaysOnTop: true,
          parent: dersekle,
          titleBarStyle: "hidden",
          webPreferences: {
            preload: path.join(__dirname, "preload.js")
          }
        });
        dersekle_input.setResizable(false);
        dersekle_input.center();
        dersekle_input.loadFile(__dirname + "/gui/dersekle_input.html");

        ipcMain.on("veri::dersekle_input_verigir", async (err, veri) => {
          try {
            db.dersler
              .insert({
                dersadi: veri.dersadi,
                ders_saati: veri.ders_saati,
                dersgunu: veri.dersgunu
              })
              .then(() => {
                console.info("set::dersgirisi");
              });
            dersekle.reload();
          } catch (e) {
            dialog.showMessageBox({ message: "Error:" + e });
          }
        });
      });
    });

    ipcMain.on("istek::uniayarla", () => {
      BrowserWindow.getFocusedWindow().hide();
      const uniayarla = new BrowserWindow({
        width: 800,
        title: "LMS Otomatik Ders",
        height: 628,
        transparent: true,
        frame: false,
        backgroundColor: "#00ffffff",
        webPreferences: {
          preload: path.join(__dirname, "preload.js")
        }
      });
      uniayarla.setResizable(false);
      uniayarla.center();
      uniayarla.loadFile(__dirname + "/gui/uniayarla.html");

      db.unisite.find({ _orderBy: "id" }).then(records => {
        uniayarla.reload();
        uniayarla.webContents.on("did-finish-load", () => {
          if (typeof records[0].unisite === undefined)
            return console.log("bildiri:ilkgiris");
          uniayarla.send("bilgi::unisite", records[0].unisite);
        });
      });
    });
  });

  ipcMain.on("istek::uniayarlagonder", async (err, data) => {
    const db = await sqlite3(dbPath);

    db.unisite.find({ _orderBy: "id" }).then(records => {
      if (records[0] === undefined) {
        db.unisite.insert({ unisite: data }).then(() => {
          console.info("set::ilkgiris:");
        });
      } else {
        db.unisite.update({ unisite: data, id: 1 }, ["id"]).then(() => {
          console.info("set::veriguncellemesi");
        });
      }
    });
  });

  ipcMain.on("istek::geridonus", () => {
    BrowserWindow.getAllWindows()[0].hide();
    anapencere.show();
  });

  ipcMain.on("bilgiler::isim", (err, data) => {
    anapencere.hide();
    let girisyapilmis = new BrowserWindow({
      width: 800,
      title: "LMS Otomatik Ders",
      height: 628,
      transparent: true,
      frame: false,
      backgroundColor: "#00ffffff",
      webPreferences: {
        preload: path.join(__dirname, "preload.js")
      }
    });
    var girisbilgileri = data;
    girisyap(girisbilgileri.kullaniciadi, girisbilgileri.kullanicisifre);
    girisyapilmis.center();
    girisyapilmis.loadFile(__dirname + "/gui/giris.html");
    girisyapilmis.setAlwaysOnTop(true, "screen");
    girisyapilmis.setResizable(false);

    try {
      Giriskontrol.girisyap();
    } catch (e) {
      console.log(e);
    }
    ipcMain.on("mesaj::girisbilgileri", (err, mesaj) => {
      console.log("Libten veri geldi, kontrol ediyorum...");
      if (mesaj === "giris_hata") return;
      console.log("Giriş başarılı sonuçlandı!");
      Ders.kontrol();
    });

    girisyapilmis.on("closed", () => {
      console.log("Sekme kapatıldı, webdriver oturumu kapatılıyor...");
      Hesap.oturumukapat().catch(err => {
        console.log("Oturum zaten açılmamış. " + err);
      });
    });

    girisyapilmis.webContents.on("did-finish-load", () => {
      girisyapilmis.webContents.send("bilgi::girisbilgileri", girisbilgileri);
    });
  });

  ipcMain.on("istek::kapat", () => {
    Hesap.oturumukapat().catch(err => {
      console.log("Oturum zaten açılmamış. " + err);
    });
    process.exit();
  });
});

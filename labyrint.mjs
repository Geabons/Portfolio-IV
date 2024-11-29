import ANSI from "./utils/ANSI.mjs";
import KeyBoardManager from "./utils/KeyBoardManager.mjs";
import { readMapFile, readRecordFile } from "./utils/fileHelpers.mjs";
import * as CONST from "./constants.mjs";

const startingLevel = CONST.START_LEVEL_ID;
const levels = loadLevelListings();

function loadLevelListings(source = CONST.LEVEL_LISTING_FILE) {
  let data = readRecordFile(source);
  let levels = {};
  for (const item of data) {
    let keyValue = item.split(":");
    if (keyValue.length >= 2) {
      let key = keyValue[0];
      let value = keyValue[1];
      levels[key] = value;
    }
  }
  return levels;
}

let levelData = readMapFile(levels[startingLevel]);
let level = levelData;

let pallet = {
  "█": ANSI.COLOR.LIGHT_GRAY,
  H: ANSI.COLOR.RED,
  $: ANSI.COLOR.YELLOW,
  B: ANSI.COLOR.GREEN,
};

let isDirty = true;

let playerPos = {
  row: null,
  col: null,
};

const EMPTY = " ";
const HERO = "H";
const LOOT = "$";

let direction = -1;

const THINGS = [LOOT, EMPTY, CONST.TELEPORT];

let eventText = "";

const HP_MAX = 10;

const playerStats = {
  hp: 8,
  chash: 0,
  strength: 10,
};

class NPC {
    constructor(row, col, type) {
        this.row = row;
        this.col = col;
        this.type = type;
        this.hp = type === 'B' ? 8 : 4;
        this.strength = type === 'B' ? 4 : 2;
    }
}

function oscillate(min, max) {
    let current = min;
    let direction = 1;
    return function () {
      if (current === max) {
        direction = -1;
      } else if (current === min) {
        direction = 1;
      }
      current += direction;
      return current;
    };
  }

  class Labyrinth {
    constructor() {
      this.currentLevel = startingLevel;
      this.npcPositions = [];
      this.teleports = [];
      this.initializeNPCs();
      this.initializeTeleports();
    }
  
    initializeNPCs() {
      for (let row = 0; row < level.length; row++) {
        for (let col = 0; col < level[row].length; col++) {
          if (level[row][col] === CONST.NPC) {
            this.npcPositions.push({
              row,
              col,
              oscillator: oscillate(col - 2, col + 2),
            });
          }
        }
      }
    }
  
    initializeTeleports() {
        this.teleports = [];
        let teleportID = 0;
        for (let row = 0; row < level.length; row++) {
            for (let col = 0; col < level[row].length; col++) {
                if (level[row][col] === CONST.TELEPORT) {
                    this.teleports.push({ row, col, id: teleportID });
                    teleportID++;
                }
            }
        }
    }
  
    update() {
        this.lastDoor = null;
      
        if (playerPos.row == null) {
          for (let row = 0; row < level.length; row++) {
            for (let col = 0; col < level[row].length; col++) {
              if (level[row][col] == HERO) {
                playerPos.row = row;
                playerPos.col = col;
                break;
              }
            }
            if (playerPos.row != undefined) {
              break;
            }
          }
        }
      
        let drow = 0;
        let dcol = 0;
      
        if (KeyBoardManager.isUpPressed()) {
          drow = -1;
        } else if (KeyBoardManager.isDownPressed()) {
          drow = 1;
        }
      
        if (KeyBoardManager.isLeftPressed()) {
          dcol = -1;
        } else if (KeyBoardManager.isRightPressed()) {
          dcol = 1;
        }
      
        let tRow = playerPos.row + drow;
        let tcol = playerPos.col + dcol;
      
        if (THINGS.includes(level[tRow][tcol])) {
          let currentItem = level[tRow][tcol];
          if (currentItem == LOOT) {
            let loot = Math.round(Math.random() * 7) + 3;
            playerStats.chash += loot;
            eventText = `Player gained ${loot}$`;
          }

          level[playerPos.row][playerPos.col] = EMPTY;
          level[tRow][tcol] = HERO;
      
          playerPos.row = tRow;
          playerPos.col = tcol;
      
          isDirty = true;
        } else {
          direction *= -1;
        }
      
        if (
          level[tRow][tcol] === CONST.DOOR_IN ||
          level[tRow][tcol] === CONST.DOOR_OUT
        ) {
          if (level[tRow][tcol] === CONST.DOOR_IN || level[tRow][tcol] === CONST.DOOR_OUT) {
            this.lastDoor = {
              level: this.currentLevel,
              row: playerPos.row,
              col: playerPos.col,
            };
            const nextLevel = level[tRow][tcol] === CONST.DOOR_IN ? "aSharpPlace" : "crowdedPlace";
            this.currentLevel = nextLevel;
            levelData = readMapFile(levels[nextLevel]);
            const entranceDoor = levelData.flat().indexOf(CONST.DOOR_OUT);
            if (entranceDoor === -1) {
              console.error("Entrance door not found in the next level!");
              return;
            }
            playerPos.row = Math.floor(entranceDoor / levelData[0].length);
            playerPos.col = entranceDoor % levelData[0].length;
            level = levelData;
            this.npcPositions = [];
            this.initializeNPCs();
            this.teleports = [];
            this.initializeTeleports();
            isDirty = true;
            return;
          }
        }
      
        for (let npc of this.npcPositions) {
          const oldCol = npc.col;
          npc.col = npc.oscillator();
          if (level[npc.row][oldCol] === CONST.NPC) level[npc.row][oldCol] = EMPTY;
          level[npc.row][npc.col] = CONST.NPC;
        }
      }
      
    draw() {
      if (isDirty == false) {
        return;
      }
      isDirty = false;
  
      console.log(ANSI.CLEAR_SCREEN, ANSI.CURSOR_HOME);
  
      let rendering = "";
  
      rendering += renderHud();
  
      for (let row = 0; row < level.length; row++) {
        let rowRendering = "";
        for (let col = 0; col < level[row].length; col++) {
          let symbol = level[row][col];
          if (pallet[symbol] != undefined) {
            rowRendering += pallet[symbol] + symbol + ANSI.COLOR_RESET;
          } else {
            rowRendering += symbol;
          }
        }
        rowRendering += "\n";
        rendering += rowRendering;
      }
  
      console.log(rendering);
  
      if (eventText != "") {
        console.log(eventText);
        eventText = "";
      }
    }
  }
  

function renderHud() {
  let hpBar = `Life:[${
    ANSI.COLOR.RED + pad(playerStats.hp, "♥︎") + ANSI.COLOR_RESET
  }${
    ANSI.COLOR.LIGHT_GRAY +
    pad(HP_MAX - playerStats.hp, "♥︎") +
    ANSI.COLOR_RESET
  }]`;
  let cash = `$:${playerStats.chash}`;
  return `${hpBar} ${cash}\n`;
}

function pad(len, text) {
  let output = "";
  for (let i = 0; i < len; i++) {
    output += text;
  }
  return output;
}

export default Labyrinth;

import Phaser from "phaser";
import { UserId, XDirection, YDirection, Player } from "../../../api/types";

import { HathoraClient, HathoraConnection, StateId } from "../../.hathora/client";
import { PLATFORMS } from "../../../shared/common";

const client = new HathoraClient();

export class GameScene extends Phaser.Scene {
  private connection!: HathoraConnection;
  private players: Map<UserId, Phaser.GameObjects.Sprite> = new Map();

  constructor() {
    super("game");
  }

  preload() {
    // load assets
    this.load.image("background", "background.png");
    this.load.image("platform", "platform.png");
    this.load.spritesheet("player", "player.png", { frameWidth: 32, frameHeight: 32 });
  }

  init() {
    // initialize server connection
    getToken().then(async (token) => {
      const stateId = await getStateId(token);
      this.connection = await client.connect(
        token,
        stateId,
        ({ state, updatedAt }) => {
          // handle state update from server
          state.players.forEach((player) => {
            if (!this.players.has(player.id)) {
              this.addPlayer(player);
            } else {
              this.updatePlayer(player);
            }
          });
        },
        (err) => console.error("Error occured", err.message)
      );
      await this.connection.joinGame({});
    });
  }

  create() {
    // background
    this.add.tileSprite(0, 0, this.scale.width, this.scale.height, "background").setOrigin(0, 0);
    PLATFORMS.forEach((platform) => {
      this.add.tileSprite(platform.x, platform.y, platform.width, platform.height, "platform").setOrigin(0, 0);
    });
    this.anims.create({
      key: "idle",
      frames: this.anims.generateFrameNumbers("player", { start: 0, end: 10 }),
      frameRate: 15,
    });
    this.anims.create({
      key: "walk",
      frames: this.anims.generateFrameNumbers("player", { start: 11, end: 22 }),
    });
    this.anims.create({
      key: "jump",
      frames: [{ key: "player", frame: 23 }],
    });
    this.anims.create({
      key: "fall",
      frames: [{ key: "player", frame: 24 }],
    });

    const keys = this.input.keyboard.createCursorKeys();
    const handleKeyEvt = () => {
      const horizontal = keys.left.isDown ? XDirection.LEFT : keys.right.isDown ? XDirection.RIGHT : XDirection.NONE;
      const vertical = keys.up.isDown ? YDirection.UP : YDirection.NONE;
      this.connection.setDirection({ direction: { horizontal, vertical } });
    };
    this.input.keyboard.on("keydown", handleKeyEvt);
    this.input.keyboard.on("keyup", handleKeyEvt);
  }

  update() {}

  private addPlayer({ id, position }: Player) {
    const sprite = this.add.sprite(position.x, position.y, "player").setOrigin(0, 0);
    this.players.set(id, sprite);
  }

  private updatePlayer({ id, position, direction }: Player) {
    const sprite = this.players.get(id)!;
    if (direction.horizontal === XDirection.LEFT) {
      sprite.setFlipX(true).anims.play("walk", true);
    } else if (direction.horizontal === XDirection.RIGHT) {
      sprite.setFlipX(false).anims.play("walk", true);
    } else if (direction.vertical === YDirection.NONE) {
      sprite.anims.play("idle", true);
    }
    if (direction.vertical === YDirection.UP) {
      sprite.anims.play("jump", true);
    } else if (direction.vertical === YDirection.DOWN) {
      sprite.anims.play("fall", true);
    }
    sprite.x = position.x;
    sprite.y = position.y;
  }
}

async function getToken(): Promise<string> {
  const storedToken = sessionStorage.getItem(client.appId);
  if (storedToken !== null) {
    return storedToken;
  }
  const token = await client.loginAnonymous();
  sessionStorage.setItem(client.appId, token);
  return token;
}

async function getStateId(token: string): Promise<StateId> {
  if (location.pathname.length > 1) {
    return location.pathname.split("/").pop()!;
  }
  const stateId = await client.create(token, {});
  history.pushState({}, "", `/${stateId}`);
  return stateId;
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  scene: [GameScene],
  parent: "phaser-container",
});

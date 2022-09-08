import { Methods, Context } from "./.hathora/methods";
import { Response } from "../api/base";
import {
  XDirection,
  YDirection,
  Position,
  Direction,
  Player,
  GameState,
  UserId,
  IInitializeRequest,
  IJoinGameRequest,
  ISetDirectionRequest,
} from "../api/types";
import { ArcadePhysics } from "arcade-physics";
import { Body } from "arcade-physics/lib/physics/arcade/Body";
import { PLATFORMS } from "../shared/common";


type InternalPlayer = {
  id: UserId;
  body: Body;
  direction: { horizontal: number; vertical: number };
};
type InternalState = {
  physics: ArcadePhysics;
  players: InternalPlayer[];
  platforms: Body[];
};


export class Impl implements Methods<InternalState> {
  initialize(): InternalState {
    const physics = new ArcadePhysics({
      sys: {
        game: { config: {} },
        settings: { physics: { gravity: { y: 200 } } },
        scale: { width: 800, height: 600 },
      },
    });
    return {
      physics,
      players: [],
      platforms: PLATFORMS.map((platform) => {
        return physics.add
          .body(platform.x, platform.y, platform.width, platform.height)
          .setAllowGravity(false)
          .setImmovable(true);
      }),
    };
  }
  joinGame(state: InternalState, userId: UserId): Response {
    if (state.players.some((player) => player.id === userId)) {
      return Response.error("Already joined");
    }

    // spawn player at (0, 0)
    const playerBody = state.physics.add.body(0, 0, 32, 32);
    playerBody.setCollideWorldBounds(true, undefined, undefined, undefined);
    playerBody.pushable = false;
    state.players.push({ id: userId, body: playerBody, direction: Direction.default() });

    // set up colliders with other players and platforms
    state.players.forEach((player) => state.physics.add.collider(playerBody, player.body));
    state.platforms.forEach((platformBody) => state.physics.add.collider(playerBody, platformBody));
    return Response.ok();
  }
  setDirection(state: InternalState, userId: UserId, ctx: Context, request: ISetDirectionRequest): Response {
    const player = state.players.find((player) => player.id === userId);
    if (player === undefined) {
      return Response.error("Not joined");
    }
    // register player input
    player.direction = request.direction;
    return Response.ok();
  }
  getUserState(state: InternalState, userId: UserId): GameState {
    // map InternalState to GameState
    return {
      players: state.players.map((player) => {
        const { x, y, velocity } = player.body;
        return {
          id: player.id,
          position: { x, y },
          direction: {
            horizontal: velocity.x < 0 ? XDirection.LEFT : velocity.x > 0 ? XDirection.RIGHT : XDirection.NONE,
            vertical: velocity.y < 0 ? YDirection.UP : velocity.y > 0 ? YDirection.DOWN : YDirection.NONE,
          },
        };
      }),
    };
  }
  onTick(state: InternalState, ctx: Context, timeDelta: number): void {
    // set player velocities based on their inputs
    state.players.forEach((player) => {
      if (player.direction.horizontal === XDirection.LEFT && !player.body.blocked.left) {
        player.body.setVelocityX(-200);
      } else if (player.direction.horizontal === XDirection.RIGHT && !player.body.blocked.right) {
        player.body.setVelocityX(200);
      } else if (player.direction.horizontal === XDirection.NONE) {
        player.body.setVelocityX(0);
      }
      if (player.direction.vertical === YDirection.UP && player.body.blocked.down) {
        player.body.setVelocityY(-200);
      }
    });
    // update the physics simulation to apply gravity, velocities, etc
    state.physics.world.update(ctx.time, timeDelta * 1000);
  }
}

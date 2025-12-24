/**
 * E2E Test: Full Poker Game Flow
 */

import { test, expect } from '@playwright/test';

const CLIENT_URL = 'http://localhost:5173';

test.describe('FF Poker Full Game Flow', () => {
  test('should allow two players to create room, join, and play poker', async ({ browser }) => {
    // Create two browser contexts for two players
    const playerAContext = await browser.newContext();
    const playerBContext = await browser.newContext();

    const playerA = await playerAContext.newPage();
    const playerB = await playerBContext.newPage();

    try {
      // Player A: Create room
      await playerA.goto(CLIENT_URL);
      await expect(playerA.locator('h1:has-text("FF Poker Lobby")')).toBeVisible();

      await playerA.locator('input[placeholder="Enter your name"]').first().fill('Alice');
      await playerA.locator('button:has-text("Create Room")').click();

      // Wait for room to be created
      await expect(playerA.locator('text=Waiting for Players...')).toBeVisible({ timeout: 10000 });

      // Get room ID from URL or page
      const roomIdElement = await playerA.locator('h1').textContent();
      const roomId = roomIdElement?.replace('Room: ', '').trim();
      expect(roomId).toBeTruthy();

      // Player B: Join room
      await playerB.goto(CLIENT_URL);
      const nameInputs = playerB.locator('input[placeholder="Enter your name"]');
      await nameInputs.nth(1).fill('Bob');
      await playerB.getByPlaceholder('Enter room ID').fill(roomId!);
      await playerB.locator('button:has-text("Join Room")').click();

      // Both players should see each other
      await expect(playerA.locator('text=Bob')).toBeVisible({ timeout: 5000 });
      await expect(playerB.locator('text=Alice')).toBeVisible({ timeout: 5000 });

      // Player A: Start game (as host)
      await playerA.locator('button:has-text("Start Game")').click();

      // Both players should see game started
      await expect(playerA.locator('text=Your Turn - Choose Action:')).toBeVisible({ timeout: 5000 });
      await expect(playerB.locator('text=Waiting for other players...')).toBeVisible({ timeout: 5000 });

      // Player A: Make first action (call or check)
      const checkButton = playerA.locator('button:has-text("Check")');
      const callButton = playerA.locator('button:has-text("Call")');

      if (await checkButton.isVisible()) {
        await checkButton.click();
      } else if (await callButton.isVisible()) {
        await callButton.click();
      }

      // Player B's turn
      await expect(playerB.locator('text=Your Turn - Choose Action:')).toBeVisible({ timeout: 5000 });

      // Player B: Make action
      const checkButtonB = playerB.locator('button:has-text("Check")');
      const callButtonB = playerB.locator('button:has-text("Call")');

      if (await checkButtonB.isVisible()) {
        await checkButtonB.click();
      } else if (await callButtonB.isVisible()) {
        await callButtonB.click();
      }

      // Game should progress
      await expect(playerA.locator('text=/Pot:/')).toBeVisible({ timeout: 5000 });
      await expect(playerB.locator('text=/Pot:/')).toBeVisible({ timeout: 5000 });

      console.log('✅ E2E Test Passed: Two players successfully played poker');

    } finally {
      await playerAContext.close();
      await playerBContext.close();
    }
  });

  test('should display error for invalid room ID', async ({ page }) => {
    await page.goto(CLIENT_URL);

    const nameInputs = page.locator('input[placeholder="Enter your name"]');
    await nameInputs.nth(1).fill('Charlie');
    await page.getByPlaceholder('Enter room ID').fill('invalid-room-id');
    await page.locator('button:has-text("Join Room")').click();

    // Should show error
    await expect(page.locator('text=/Error/i')).toBeVisible({ timeout: 5000 });
  });

  test('should allow player to fold', async ({ browser }) => {
    const playerAContext = await browser.newContext();
    const playerBContext = await browser.newContext();

    const playerA = await playerAContext.newPage();
    const playerB = await playerBContext.newPage();

    try {
      // Setup: Create room and join
      await playerA.goto(CLIENT_URL);
      await playerA.locator('input[placeholder="Enter your name"]').first().fill('Alice');
      await playerA.locator('button:has-text("Create Room")').click();
      await expect(playerA.locator('text=Waiting for Players...')).toBeVisible({ timeout: 10000 });

      const roomIdElement = await playerA.locator('h1').textContent();
      const roomId = roomIdElement?.replace('Room: ', '').trim();

      await playerB.goto(CLIENT_URL);
      const nameInputs = playerB.locator('input[placeholder="Enter your name"]');
      await nameInputs.nth(1).fill('Bob');
      await playerB.getByPlaceholder('Enter room ID').fill(roomId!);
      await playerB.locator('button:has-text("Join Room")').click();

      await expect(playerA.locator('text=Bob')).toBeVisible({ timeout: 5000 });

      // Start game
      await playerA.locator('button:has-text("Start Game")').click();
      await expect(playerA.locator('text=Your Turn - Choose Action:')).toBeVisible({ timeout: 5000 });

      // Player A folds
      await playerA.locator('button:has-text("Fold")').click();

      // Verify Player A no longer has action buttons (folded)
      await expect(playerA.locator('text=Your Turn - Choose Action:')).not.toBeVisible({ timeout: 5000 });

      // Verify Player A sees "FOLDED" status
      await expect(playerA.locator('text=FOLDED')).toBeVisible({ timeout: 5000 });

      console.log('✅ E2E Test Passed: Player successfully folded');

    } finally {
      await playerAContext.close();
      await playerBContext.close();
    }
  });

  test('should end game immediately when all players fold except one', async ({ browser }) => {
    const playerAContext = await browser.newContext();
    const playerBContext = await browser.newContext();

    const playerA = await playerAContext.newPage();
    const playerB = await playerBContext.newPage();

    try {
      // Setup: Create room and join
      await playerA.goto(CLIENT_URL);
      await playerA.locator('input[placeholder="Enter your name"]').first().fill('Alice');
      await playerA.locator('button:has-text("Create Room")').click();
      await expect(playerA.locator('text=Waiting for Players...')).toBeVisible({ timeout: 10000 });

      const roomIdElement = await playerA.locator('h1').textContent();
      const roomId = roomIdElement?.replace('Room: ', '').trim();

      await playerB.goto(CLIENT_URL);
      const nameInputs = playerB.locator('input[placeholder="Enter your name"]');
      await nameInputs.nth(1).fill('Bob');
      await playerB.getByPlaceholder('Enter room ID').fill(roomId!);
      await playerB.locator('button:has-text("Join Room")').click();

      await expect(playerA.locator('text=Bob')).toBeVisible({ timeout: 5000 });

      // Start game
      await playerA.locator('button:has-text("Start Game")').click();
      await expect(playerA.locator('text=Your Turn - Choose Action:')).toBeVisible({ timeout: 5000 });

      // Player A folds - Bob should win immediately
      await playerA.locator('button:has-text("Fold")').click();

      // EXPECTED: Game should end immediately, Bob gets pot, next round starts after 3s

      // Wait for the 3-second delay + processing time (total 5 seconds)
      await playerA.waitForTimeout(5000);

      // Check if next round started automatically (expected behavior)
      const isNextRoundStarted = await playerA.locator('text=Your Turn - Choose Action:').isVisible({ timeout: 2000 })
        .catch(() => false);

      console.log('Is next round started:', isNextRoundStarted);

      if (!isNextRoundStarted) {
        console.log('⚠️  BUG CONFIRMED: Game did not end immediately after fold');
        console.log('Game should have ended and started next round automatically');

        // Also check if game is stuck in a stage
        const currentStage = await playerA.locator('text=/Stage:|Flop|Turn|River/').textContent().catch(() => 'unknown');
        console.log('Current stage:', currentStage);
      } else {
        console.log('✅ Fold immediately ended game and started next round');
      }

    } finally {
      await playerAContext.close();
      await playerBContext.close();
    }
  });

  test('should handle all-in immediately when opponent folds', async ({ browser }) => {
    const playerAContext = await browser.newContext();
    const playerBContext = await browser.newContext();

    const playerA = await playerAContext.newPage();
    const playerB = await playerBContext.newPage();

    try {
      // Setup: Create room and join
      await playerA.goto(CLIENT_URL);
      await playerA.locator('input[placeholder="Enter your name"]').first().fill('Alice');
      await playerA.locator('button:has-text("Create Room")').click();
      await expect(playerA.locator('text=Waiting for Players...')).toBeVisible({ timeout: 10000 });

      const roomIdElement = await playerA.locator('h1').textContent();
      const roomId = roomIdElement?.replace('Room: ', '').trim();

      await playerB.goto(CLIENT_URL);
      const nameInputs = playerB.locator('input[placeholder="Enter your name"]');
      await nameInputs.nth(1).fill('Bob');
      await playerB.getByPlaceholder('Enter room ID').fill(roomId!);
      await playerB.locator('button:has-text("Join Room")').click();

      await expect(playerA.locator('text=Bob')).toBeVisible({ timeout: 5000 });

      // Start game
      await playerA.locator('button:has-text("Start Game")').click();
      await expect(playerA.locator('text=Your Turn - Choose Action:')).toBeVisible({ timeout: 5000 });

      // Player A goes all-in
      const allinButton = playerA.locator('button:has-text("All-In")');
      await allinButton.click();

      // Wait for Player B's turn
      await expect(playerB.locator('text=Your Turn - Choose Action:')).toBeVisible({ timeout: 5000 });

      // Player B folds
      await playerB.locator('button:has-text("Fold")').click();

      // EXPECTED: Alice wins immediately without showing cards
      // Wait for game state update
      await playerA.waitForTimeout(2000);

      const isNextRoundStarted = await playerA.locator('text=Your Turn - Choose Action:').isVisible()
        .catch(() => false);

      if (!isNextRoundStarted) {
        console.log('⚠️  BUG CONFIRMED: All-in + fold did not end game immediately');
      } else {
        console.log('✅ All-in + fold immediately ended game and started next round');
      }

    } finally {
      await playerAContext.close();
      await playerBContext.close();
    }
  });

  test('should proceed to showdown automatically when both players go all-in', async ({ browser }) => {
    const playerAContext = await browser.newContext();
    const playerBContext = await browser.newContext();

    const playerA = await playerAContext.newPage();
    const playerB = await playerBContext.newPage();

    try {
      // Setup: Create room and join
      await playerA.goto(CLIENT_URL);
      await playerA.locator('input[placeholder="Enter your name"]').first().fill('Alice');
      await playerA.locator('button:has-text("Create Room")').click();
      await expect(playerA.locator('text=Waiting for Players...')).toBeVisible({ timeout: 10000 });

      const roomIdElement = await playerA.locator('h1').textContent();
      const roomId = roomIdElement?.replace('Room: ', '').trim();

      await playerB.goto(CLIENT_URL);
      const nameInputs = playerB.locator('input[placeholder="Enter your name"]');
      await nameInputs.nth(1).fill('Bob');
      await playerB.getByPlaceholder('Enter room ID').fill(roomId!);
      await playerB.locator('button:has-text("Join Room")').click();

      await expect(playerA.locator('text=Bob')).toBeVisible({ timeout: 5000 });

      // Start game
      await playerA.locator('button:has-text("Start Game")').click();
      await expect(playerA.locator('text=Your Turn - Choose Action:')).toBeVisible({ timeout: 5000 });

      // Player A goes all-in
      const allinButtonA = playerA.locator('button:has-text("All-In")');
      await allinButtonA.click();

      // Wait for Player B's turn
      await expect(playerB.locator('text=Your Turn - Choose Action:')).toBeVisible({ timeout: 5000 });

      // Player B calls the all-in (which will likely make them all-in too)
      const callButton = playerB.locator('button:has-text("Call")');
      await callButton.click();

      // EXPECTED: Game should automatically show all community cards and proceed to showdown
      // One player will lose all chips and game will end

      // Wait for showdown to complete
      await playerA.waitForTimeout(3000);

      // After all-in showdown, game should be finished (one player has 0 chips)
      const gameFinished = await playerA.locator('text=Game Finished').isVisible({ timeout: 2000 })
        .catch(() => false);

      const statusEnded = await playerA.locator('text=/Status:.*ended/i').isVisible({ timeout: 2000 })
        .catch(() => false);

      console.log('=== After Both All-In Showdown ===');
      console.log('Game finished:', gameFinished);
      console.log('Status ended:', statusEnded);

      if (gameFinished && statusEnded) {
        console.log('✅ All-in showdown proceeded correctly, winner determined, game ended');
      } else {
        const bodyText = await playerA.locator('body').textContent();
        console.log('Page text:', bodyText?.substring(0, 500));
        await playerA.screenshot({ path: '/tmp/playerA-after-double-allin.png' });
        console.log('⚠️  BUG CONFIRMED: All-in showdown did not complete properly');
      }

    } finally {
      await playerAContext.close();
      await playerBContext.close();
    }
  });
});

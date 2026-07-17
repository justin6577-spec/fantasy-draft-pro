/**
 * NFL Player seed data for Fantasy Draft Assistant.
 *
 * Run: npx tsx prisma/seed.ts
 *
 * Covers all 32 NFL teams with projected 2026 rosters:
 * QB, RB, WR, TE, K, DEF for each team.
 * Bye weeks follow the standard 2025 rotation as a reasonable placeholder.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PlayerSeed {
  name: string;
  position: string;
  team: string;
  byeWeek: number;
  externalIds?: Record<string, string>;
}

const BYE_WEEKS: Record<string, number> = {
  ARI: 14, ATL: 11, BAL: 13, BUF: 13,
  CAR: 9,  CHI: 13, CIN: 14, CLE: 14,
  DAL: 11, DEN: 9,  DET: 9,  GB:  10,
  HOU: 13, IND: 11, JAX: 14, KC:  10,
  LAC: 13, LAR: 10, LV:  9,  MIA: 14,
  MIN: 10, NE:  11, NO:  9,  NYG: 11,
  NYJ: 13, PHI: 10, PIT: 10, SEA: 9,
  SF:  14, TB:  11, TEN: 13, WAS: 14,
};

const PLAYERS: PlayerSeed[] = [
  // ── Arizona Cardinals ──
  { name: 'Kyler Murray', position: 'QB', team: 'ARI', byeWeek: 14 },
  { name: 'James Conner', position: 'RB', team: 'ARI', byeWeek: 14 },
  { name: 'Trey McBride', position: 'TE', team: 'ARI', byeWeek: 14 },
  { name: 'Marvin Harrison Jr.', position: 'WR', team: 'ARI', byeWeek: 14 },
  { name: 'Michael Wilson', position: 'WR', team: 'ARI', byeWeek: 14 },
  { name: 'Greg Dortch', position: 'WR', team: 'ARI', byeWeek: 14 },
  { name: 'Chad Ryland', position: 'K', team: 'ARI', byeWeek: 14 },
  { name: 'Cardinals Defense', position: 'DEF', team: 'ARI', byeWeek: 14 },

  // ── Atlanta Falcons ──
  { name: 'Kirk Cousins', position: 'QB', team: 'ATL', byeWeek: 11 },
  { name: 'Michael Penix Jr.', position: 'QB', team: 'ATL', byeWeek: 11 },
  { name: 'Bijan Robinson', position: 'RB', team: 'ATL', byeWeek: 11 },
  { name: 'Tyler Allgeier', position: 'RB', team: 'ATL', byeWeek: 11 },
  { name: 'Drake London', position: 'WR', team: 'ATL', byeWeek: 11 },
  { name: 'Darnell Mooney', position: 'WR', team: 'ATL', byeWeek: 11 },
  { name: 'Kyle Pitts', position: 'TE', team: 'ATL', byeWeek: 11 },
  { name: 'Younghoe Koo', position: 'K', team: 'ATL', byeWeek: 11 },
  { name: 'Falcons Defense', position: 'DEF', team: 'ATL', byeWeek: 11 },

  // ── Baltimore Ravens ──
  { name: 'Lamar Jackson', position: 'QB', team: 'BAL', byeWeek: 13 },
  { name: 'Derrick Henry', position: 'RB', team: 'BAL', byeWeek: 13 },
  { name: 'Justice Hill', position: 'RB', team: 'BAL', byeWeek: 13 },
  { name: 'Zay Flowers', position: 'WR', team: 'BAL', byeWeek: 13 },
  { name: 'Rashod Bateman', position: 'WR', team: 'BAL', byeWeek: 13 },
  { name: 'Mark Andrews', position: 'TE', team: 'BAL', byeWeek: 13 },
  { name: 'Isaiah Likely', position: 'TE', team: 'BAL', byeWeek: 13 },
  { name: 'Justin Tucker', position: 'K', team: 'BAL', byeWeek: 13 },
  { name: 'Ravens Defense', position: 'DEF', team: 'BAL', byeWeek: 13 },

  // ── Buffalo Bills ──
  { name: 'Josh Allen', position: 'QB', team: 'BUF', byeWeek: 13 },
  { name: 'James Cook', position: 'RB', team: 'BUF', byeWeek: 13 },
  { name: 'Ray Davis', position: 'RB', team: 'BUF', byeWeek: 13 },
  { name: 'Khalil Shakir', position: 'WR', team: 'BUF', byeWeek: 13 },
  { name: 'Keon Coleman', position: 'WR', team: 'BUF', byeWeek: 13 },
  { name: 'Dalton Kincaid', position: 'TE', team: 'BUF', byeWeek: 13 },
  { name: 'Tyler Bass', position: 'K', team: 'BUF', byeWeek: 13 },
  { name: 'Bills Defense', position: 'DEF', team: 'BUF', byeWeek: 13 },

  // ── Carolina Panthers ──
  { name: 'Bryce Young', position: 'QB', team: 'CAR', byeWeek: 9 },
  { name: 'Chuba Hubbard', position: 'RB', team: 'CAR', byeWeek: 9 },
  { name: 'Jonathon Brooks', position: 'RB', team: 'CAR', byeWeek: 9 },
  { name: 'Adam Thielen', position: 'WR', team: 'CAR', byeWeek: 9 },
  { name: 'Xavier Legette', position: 'WR', team: 'CAR', byeWeek: 9 },
  { name: 'Tommy Tremble', position: 'TE', team: 'CAR', byeWeek: 9 },
  { name: 'Eddy Pineiro', position: 'K', team: 'CAR', byeWeek: 9 },
  { name: 'Panthers Defense', position: 'DEF', team: 'CAR', byeWeek: 9 },

  // ── Chicago Bears ──
  { name: 'Caleb Williams', position: 'QB', team: 'CHI', byeWeek: 13 },
  { name: 'D\'Andre Swift', position: 'RB', team: 'CHI', byeWeek: 13 },
  { name: 'DJ Moore', position: 'WR', team: 'CHI', byeWeek: 13 },
  { name: 'Rome Odunze', position: 'WR', team: 'CHI', byeWeek: 13 },
  { name: 'Keenan Allen', position: 'WR', team: 'CHI', byeWeek: 13 },
  { name: 'Cole Kmet', position: 'TE', team: 'CHI', byeWeek: 13 },
  { name: 'Cairo Santos', position: 'K', team: 'CHI', byeWeek: 13 },
  { name: 'Bears Defense', position: 'DEF', team: 'CHI', byeWeek: 13 },

  // ── Cincinnati Bengals ──
  { name: 'Joe Burrow', position: 'QB', team: 'CIN', byeWeek: 14 },
  { name: 'Chase Brown', position: 'RB', team: 'CIN', byeWeek: 14 },
  { name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN', byeWeek: 14 },
  { name: 'Tee Higgins', position: 'WR', team: 'CIN', byeWeek: 14 },
  { name: 'Andrei Iosivas', position: 'WR', team: 'CIN', byeWeek: 14 },
  { name: 'Mike Gesicki', position: 'TE', team: 'CIN', byeWeek: 14 },
  { name: 'Evan McPherson', position: 'K', team: 'CIN', byeWeek: 14 },
  { name: 'Bengals Defense', position: 'DEF', team: 'CIN', byeWeek: 14 },

  // ── Cleveland Browns ──
  { name: 'Deshaun Watson', position: 'QB', team: 'CLE', byeWeek: 14 },
  { name: 'Nick Chubb', position: 'RB', team: 'CLE', byeWeek: 14 },
  { name: 'Jerome Ford', position: 'RB', team: 'CLE', byeWeek: 14 },
  { name: 'Amari Cooper', position: 'WR', team: 'CLE', byeWeek: 14 },
  { name: 'Jerry Jeudy', position: 'WR', team: 'CLE', byeWeek: 14 },
  { name: 'David Njoku', position: 'TE', team: 'CLE', byeWeek: 14 },
  { name: 'Dustin Hopkins', position: 'K', team: 'CLE', byeWeek: 14 },
  { name: 'Browns Defense', position: 'DEF', team: 'CLE', byeWeek: 14 },

  // ── Dallas Cowboys ──
  { name: 'Dak Prescott', position: 'QB', team: 'DAL', byeWeek: 11 },
  { name: 'Ezekiel Elliott', position: 'RB', team: 'DAL', byeWeek: 11 },
  { name: 'Rico Dowdle', position: 'RB', team: 'DAL', byeWeek: 11 },
  { name: 'CeeDee Lamb', position: 'WR', team: 'DAL', byeWeek: 11 },
  { name: 'Brandin Cooks', position: 'WR', team: 'DAL', byeWeek: 11 },
  { name: 'Jake Ferguson', position: 'TE', team: 'DAL', byeWeek: 11 },
  { name: 'Brandon Aubrey', position: 'K', team: 'DAL', byeWeek: 11 },
  { name: 'Cowboys Defense', position: 'DEF', team: 'DAL', byeWeek: 11 },

  // ── Denver Broncos ──
  { name: 'Bo Nix', position: 'QB', team: 'DEN', byeWeek: 9 },
  { name: 'Javonte Williams', position: 'RB', team: 'DEN', byeWeek: 9 },
  { name: 'Jaleel McLaughlin', position: 'RB', team: 'DEN', byeWeek: 9 },
  { name: 'Courtland Sutton', position: 'WR', team: 'DEN', byeWeek: 9 },
  { name: 'Marvin Mims', position: 'WR', team: 'DEN', byeWeek: 9 },
  { name: 'Greg Dulcich', position: 'TE', team: 'DEN', byeWeek: 9 },
  { name: 'Wil Lutz', position: 'K', team: 'DEN', byeWeek: 9 },
  { name: 'Broncos Defense', position: 'DEF', team: 'DEN', byeWeek: 9 },

  // ── Detroit Lions ──
  { name: 'Jared Goff', position: 'QB', team: 'DET', byeWeek: 9 },
  { name: 'David Montgomery', position: 'RB', team: 'DET', byeWeek: 9 },
  { name: 'Jahmyr Gibbs', position: 'RB', team: 'DET', byeWeek: 9 },
  { name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET', byeWeek: 9 },
  { name: 'Jameson Williams', position: 'WR', team: 'DET', byeWeek: 9 },
  { name: 'Sam LaPorta', position: 'TE', team: 'DET', byeWeek: 9 },
  { name: 'Jake Bates', position: 'K', team: 'DET', byeWeek: 9 },
  { name: 'Lions Defense', position: 'DEF', team: 'DET', byeWeek: 9 },

  // ── Green Bay Packers ──
  { name: 'Jordan Love', position: 'QB', team: 'GB', byeWeek: 10 },
  { name: 'Josh Jacobs', position: 'RB', team: 'GB', byeWeek: 10 },
  { name: 'Jayden Reed', position: 'WR', team: 'GB', byeWeek: 10 },
  { name: 'Christian Watson', position: 'WR', team: 'GB', byeWeek: 10 },
  { name: 'Romeo Doubs', position: 'WR', team: 'GB', byeWeek: 10 },
  { name: 'Tucker Kraft', position: 'TE', team: 'GB', byeWeek: 10 },
  { name: 'Anders Carlson', position: 'K', team: 'GB', byeWeek: 10 },
  { name: 'Packers Defense', position: 'DEF', team: 'GB', byeWeek: 10 },

  // ── Houston Texans ──
  { name: 'C.J. Stroud', position: 'QB', team: 'HOU', byeWeek: 13 },
  { name: 'Joe Mixon', position: 'RB', team: 'HOU', byeWeek: 13 },
  { name: 'Dameon Pierce', position: 'RB', team: 'HOU', byeWeek: 13 },
  { name: 'Nico Collins', position: 'WR', team: 'HOU', byeWeek: 13 },
  { name: 'Tank Dell', position: 'WR', team: 'HOU', byeWeek: 13 },
  { name: 'Stefon Diggs', position: 'WR', team: 'HOU', byeWeek: 13 },
  { name: 'Dalton Schultz', position: 'TE', team: 'HOU', byeWeek: 13 },
  { name: 'Ka\'imi Fairbairn', position: 'K', team: 'HOU', byeWeek: 13 },
  { name: 'Texans Defense', position: 'DEF', team: 'HOU', byeWeek: 13 },

  // ── Indianapolis Colts ──
  { name: 'Anthony Richardson', position: 'QB', team: 'IND', byeWeek: 11 },
  { name: 'Jonathan Taylor', position: 'RB', team: 'IND', byeWeek: 11 },
  { name: 'Michael Pittman Jr.', position: 'WR', team: 'IND', byeWeek: 11 },
  { name: 'Josh Downs', position: 'WR', team: 'IND', byeWeek: 11 },
  { name: 'Alec Pierce', position: 'WR', team: 'IND', byeWeek: 11 },
  { name: 'Kylen Granson', position: 'TE', team: 'IND', byeWeek: 11 },
  { name: 'Matt Gay', position: 'K', team: 'IND', byeWeek: 11 },
  { name: 'Colts Defense', position: 'DEF', team: 'IND', byeWeek: 11 },

  // ── Jacksonville Jaguars ──
  { name: 'Trevor Lawrence', position: 'QB', team: 'JAX', byeWeek: 14 },
  { name: 'Travis Etienne', position: 'RB', team: 'JAX', byeWeek: 14 },
  { name: 'Tank Bigsby', position: 'RB', team: 'JAX', byeWeek: 14 },
  { name: 'Brian Thomas Jr.', position: 'WR', team: 'JAX', byeWeek: 14 },
  { name: 'Christian Kirk', position: 'WR', team: 'JAX', byeWeek: 14 },
  { name: 'Gabe Davis', position: 'WR', team: 'JAX', byeWeek: 14 },
  { name: 'Evan Engram', position: 'TE', team: 'JAX', byeWeek: 14 },
  { name: 'Cam Little', position: 'K', team: 'JAX', byeWeek: 14 },
  { name: 'Jaguars Defense', position: 'DEF', team: 'JAX', byeWeek: 14 },

  // ── Kansas City Chiefs ──
  { name: 'Patrick Mahomes', position: 'QB', team: 'KC', byeWeek: 10 },
  { name: 'Isiah Pacheco', position: 'RB', team: 'KC', byeWeek: 10 },
  { name: 'Kareem Hunt', position: 'RB', team: 'KC', byeWeek: 10 },
  { name: 'Travis Kelce', position: 'TE', team: 'KC', byeWeek: 10 },
  { name: 'Rashee Rice', position: 'WR', team: 'KC', byeWeek: 10 },
  { name: 'Marquise Brown', position: 'WR', team: 'KC', byeWeek: 10 },
  { name: 'Xavier Worthy', position: 'WR', team: 'KC', byeWeek: 10 },
  { name: 'Harrison Butker', position: 'K', team: 'KC', byeWeek: 10 },
  { name: 'Chiefs Defense', position: 'DEF', team: 'KC', byeWeek: 10 },

  // ── Las Vegas Raiders ──
  { name: 'Gardner Minshew', position: 'QB', team: 'LV', byeWeek: 9 },
  { name: 'Zamir White', position: 'RB', team: 'LV', byeWeek: 9 },
  { name: 'Alexander Mattison', position: 'RB', team: 'LV', byeWeek: 9 },
  { name: 'Davante Adams', position: 'WR', team: 'LV', byeWeek: 9 },
  { name: 'Jakobi Meyers', position: 'WR', team: 'LV', byeWeek: 9 },
  { name: 'Brock Bowers', position: 'TE', team: 'LV', byeWeek: 9 },
  { name: 'Daniel Carlson', position: 'K', team: 'LV', byeWeek: 9 },
  { name: 'Raiders Defense', position: 'DEF', team: 'LV', byeWeek: 9 },

  // ── Los Angeles Chargers ──
  { name: 'Justin Herbert', position: 'QB', team: 'LAC', byeWeek: 13 },
  { name: 'J.K. Dobbins', position: 'RB', team: 'LAC', byeWeek: 13 },
  { name: 'Gus Edwards', position: 'RB', team: 'LAC', byeWeek: 13 },
  { name: 'Ladd McConkey', position: 'WR', team: 'LAC', byeWeek: 13 },
  { name: 'Quentin Johnston', position: 'WR', team: 'LAC', byeWeek: 13 },
  { name: 'Joshua Palmer', position: 'WR', team: 'LAC', byeWeek: 13 },
  { name: 'Will Dissly', position: 'TE', team: 'LAC', byeWeek: 13 },
  { name: 'Cameron Dicker', position: 'K', team: 'LAC', byeWeek: 13 },
  { name: 'Chargers Defense', position: 'DEF', team: 'LAC', byeWeek: 13 },

  // ── Los Angeles Rams ──
  { name: 'Matthew Stafford', position: 'QB', team: 'LAR', byeWeek: 10 },
  { name: 'Kyren Williams', position: 'RB', team: 'LAR', byeWeek: 10 },
  { name: 'Blake Corum', position: 'RB', team: 'LAR', byeWeek: 10 },
  { name: 'Cooper Kupp', position: 'WR', team: 'LAR', byeWeek: 10 },
  { name: 'Puka Nacua', position: 'WR', team: 'LAR', byeWeek: 10 },
  { name: 'Demarcus Robinson', position: 'WR', team: 'LAR', byeWeek: 10 },
  { name: 'Tyler Higbee', position: 'TE', team: 'LAR', byeWeek: 10 },
  { name: 'Joshua Karty', position: 'K', team: 'LAR', byeWeek: 10 },
  { name: 'Rams Defense', position: 'DEF', team: 'LAR', byeWeek: 10 },

  // ── Miami Dolphins ──
  { name: 'Tua Tagovailoa', position: 'QB', team: 'MIA', byeWeek: 14 },
  { name: 'De\'Von Achane', position: 'RB', team: 'MIA', byeWeek: 14 },
  { name: 'Raheem Mostert', position: 'RB', team: 'MIA', byeWeek: 14 },
  { name: 'Tyreek Hill', position: 'WR', team: 'MIA', byeWeek: 14 },
  { name: 'Jaylen Waddle', position: 'WR', team: 'MIA', byeWeek: 14 },
  { name: 'Jonnu Smith', position: 'TE', team: 'MIA', byeWeek: 14 },
  { name: 'Jason Sanders', position: 'K', team: 'MIA', byeWeek: 14 },
  { name: 'Dolphins Defense', position: 'DEF', team: 'MIA', byeWeek: 14 },

  // ── Minnesota Vikings ──
  { name: 'Sam Darnold', position: 'QB', team: 'MIN', byeWeek: 10 },
  { name: 'Aaron Jones', position: 'RB', team: 'MIN', byeWeek: 10 },
  { name: 'Ty Chandler', position: 'RB', team: 'MIN', byeWeek: 10 },
  { name: 'Justin Jefferson', position: 'WR', team: 'MIN', byeWeek: 10 },
  { name: 'Jordan Addison', position: 'WR', team: 'MIN', byeWeek: 10 },
  { name: 'T.J. Hockenson', position: 'TE', team: 'MIN', byeWeek: 10 },
  { name: 'Will Reichard', position: 'K', team: 'MIN', byeWeek: 10 },
  { name: 'Vikings Defense', position: 'DEF', team: 'MIN', byeWeek: 10 },

  // ── New England Patriots ──
  { name: 'Drake Maye', position: 'QB', team: 'NE', byeWeek: 11 },
  { name: 'Rhamondre Stevenson', position: 'RB', team: 'NE', byeWeek: 11 },
  { name: 'Antonio Gibson', position: 'RB', team: 'NE', byeWeek: 11 },
  { name: 'DeMario Douglas', position: 'WR', team: 'NE', byeWeek: 11 },
  { name: 'Ja\'Lynn Polk', position: 'WR', team: 'NE', byeWeek: 11 },
  { name: 'Kendrick Bourne', position: 'WR', team: 'NE', byeWeek: 11 },
  { name: 'Hunter Henry', position: 'TE', team: 'NE', byeWeek: 11 },
  { name: 'Joey Slye', position: 'K', team: 'NE', byeWeek: 11 },
  { name: 'Patriots Defense', position: 'DEF', team: 'NE', byeWeek: 11 },

  // ── New Orleans Saints ──
  { name: 'Derek Carr', position: 'QB', team: 'NO', byeWeek: 9 },
  { name: 'Alvin Kamara', position: 'RB', team: 'NO', byeWeek: 9 },
  { name: 'Jamaal Williams', position: 'RB', team: 'NO', byeWeek: 9 },
  { name: 'Chris Olave', position: 'WR', team: 'NO', byeWeek: 9 },
  { name: 'Rashid Shaheed', position: 'WR', team: 'NO', byeWeek: 9 },
  { name: 'Juwan Johnson', position: 'TE', team: 'NO', byeWeek: 9 },
  { name: 'Blake Grupe', position: 'K', team: 'NO', byeWeek: 9 },
  { name: 'Saints Defense', position: 'DEF', team: 'NO', byeWeek: 9 },

  // ── New York Giants ──
  { name: 'Daniel Jones', position: 'QB', team: 'NYG', byeWeek: 11 },
  { name: 'Devin Singletary', position: 'RB', team: 'NYG', byeWeek: 11 },
  { name: 'Tyrone Tracy Jr.', position: 'RB', team: 'NYG', byeWeek: 11 },
  { name: 'Malik Nabers', position: 'WR', team: 'NYG', byeWeek: 11 },
  { name: 'Wan\'Dale Robinson', position: 'WR', team: 'NYG', byeWeek: 11 },
  { name: 'Darius Slayton', position: 'WR', team: 'NYG', byeWeek: 11 },
  { name: 'Theo Johnson', position: 'TE', team: 'NYG', byeWeek: 11 },
  { name: 'Graham Gano', position: 'K', team: 'NYG', byeWeek: 11 },
  { name: 'Giants Defense', position: 'DEF', team: 'NYG', byeWeek: 11 },

  // ── New York Jets ──
  { name: 'Aaron Rodgers', position: 'QB', team: 'NYJ', byeWeek: 13 },
  { name: 'Breece Hall', position: 'RB', team: 'NYJ', byeWeek: 13 },
  { name: 'Braelon Allen', position: 'RB', team: 'NYJ', byeWeek: 13 },
  { name: 'Garrett Wilson', position: 'WR', team: 'NYJ', byeWeek: 13 },
  { name: 'Mike Williams', position: 'WR', team: 'NYJ', byeWeek: 13 },
  { name: 'Tyler Conklin', position: 'TE', team: 'NYJ', byeWeek: 13 },
  { name: 'Greg Zuerlein', position: 'K', team: 'NYJ', byeWeek: 13 },
  { name: 'Jets Defense', position: 'DEF', team: 'NYJ', byeWeek: 13 },

  // ── Philadelphia Eagles ──
  { name: 'Jalen Hurts', position: 'QB', team: 'PHI', byeWeek: 10 },
  { name: 'Saquon Barkley', position: 'RB', team: 'PHI', byeWeek: 10 },
  { name: 'Kenneth Gainwell', position: 'RB', team: 'PHI', byeWeek: 10 },
  { name: 'A.J. Brown', position: 'WR', team: 'PHI', byeWeek: 10 },
  { name: 'DeVonta Smith', position: 'WR', team: 'PHI', byeWeek: 10 },
  { name: 'Dallas Goedert', position: 'TE', team: 'PHI', byeWeek: 10 },
  { name: 'Jake Elliott', position: 'K', team: 'PHI', byeWeek: 10 },
  { name: 'Eagles Defense', position: 'DEF', team: 'PHI', byeWeek: 10 },

  // ── Pittsburgh Steelers ──
  { name: 'Russell Wilson', position: 'QB', team: 'PIT', byeWeek: 10 },
  { name: 'Najee Harris', position: 'RB', team: 'PIT', byeWeek: 10 },
  { name: 'Jaylen Warren', position: 'RB', team: 'PIT', byeWeek: 10 },
  { name: 'George Pickens', position: 'WR', team: 'PIT', byeWeek: 10 },
  { name: 'Roman Wilson', position: 'WR', team: 'PIT', byeWeek: 10 },
  { name: 'Pat Freiermuth', position: 'TE', team: 'PIT', byeWeek: 10 },
  { name: 'Chris Boswell', position: 'K', team: 'PIT', byeWeek: 10 },
  { name: 'Steelers Defense', position: 'DEF', team: 'PIT', byeWeek: 10 },

  // ── San Francisco 49ers ──
  { name: 'Brock Purdy', position: 'QB', team: 'SF', byeWeek: 14 },
  { name: 'Christian McCaffrey', position: 'RB', team: 'SF', byeWeek: 14 },
  { name: 'Jordan Mason', position: 'RB', team: 'SF', byeWeek: 14 },
  { name: 'Deebo Samuel', position: 'WR', team: 'SF', byeWeek: 14 },
  { name: 'Brandon Aiyuk', position: 'WR', team: 'SF', byeWeek: 14 },
  { name: 'George Kittle', position: 'TE', team: 'SF', byeWeek: 14 },
  { name: 'Jake Moody', position: 'K', team: 'SF', byeWeek: 14 },
  { name: '49ers Defense', position: 'DEF', team: 'SF', byeWeek: 14 },

  // ── Seattle Seahawks ──
  { name: 'Geno Smith', position: 'QB', team: 'SEA', byeWeek: 9 },
  { name: 'Kenneth Walker III', position: 'RB', team: 'SEA', byeWeek: 9 },
  { name: 'Zach Charbonnet', position: 'RB', team: 'SEA', byeWeek: 9 },
  { name: 'DK Metcalf', position: 'WR', team: 'SEA', byeWeek: 9 },
  { name: 'Tyler Lockett', position: 'WR', team: 'SEA', byeWeek: 9 },
  { name: 'Jaxon Smith-Njigba', position: 'WR', team: 'SEA', byeWeek: 9 },
  { name: 'Noah Fant', position: 'TE', team: 'SEA', byeWeek: 9 },
  { name: 'Jason Myers', position: 'K', team: 'SEA', byeWeek: 9 },
  { name: 'Seahawks Defense', position: 'DEF', team: 'SEA', byeWeek: 9 },

  // ── Tampa Bay Buccaneers ──
  { name: 'Baker Mayfield', position: 'QB', team: 'TB', byeWeek: 11 },
  { name: 'Rachaad White', position: 'RB', team: 'TB', byeWeek: 11 },
  { name: 'Bucky Irving', position: 'RB', team: 'TB', byeWeek: 11 },
  { name: 'Mike Evans', position: 'WR', team: 'TB', byeWeek: 11 },
  { name: 'Chris Godwin', position: 'WR', team: 'TB', byeWeek: 11 },
  { name: 'Cade Otton', position: 'TE', team: 'TB', byeWeek: 11 },
  { name: 'Chase McLaughlin', position: 'K', team: 'TB', byeWeek: 11 },
  { name: 'Buccaneers Defense', position: 'DEF', team: 'TB', byeWeek: 11 },

  // ── Tennessee Titans ──
  { name: 'Will Levis', position: 'QB', team: 'TEN', byeWeek: 13 },
  { name: 'Tony Pollard', position: 'RB', team: 'TEN', byeWeek: 13 },
  { name: 'Tyjae Spears', position: 'RB', team: 'TEN', byeWeek: 13 },
  { name: 'DeAndre Hopkins', position: 'WR', team: 'TEN', byeWeek: 13 },
  { name: 'Calvin Ridley', position: 'WR', team: 'TEN', byeWeek: 13 },
  { name: 'Chig Okonkwo', position: 'TE', team: 'TEN', byeWeek: 13 },
  { name: 'Nick Folk', position: 'K', team: 'TEN', byeWeek: 13 },
  { name: 'Titans Defense', position: 'DEF', team: 'TEN', byeWeek: 13 },

  // ── Washington Commanders ──
  { name: 'Jayden Daniels', position: 'QB', team: 'WAS', byeWeek: 14 },
  { name: 'Brian Robinson Jr.', position: 'RB', team: 'WAS', byeWeek: 14 },
  { name: 'Austin Ekeler', position: 'RB', team: 'WAS', byeWeek: 14 },
  { name: 'Terry McLaurin', position: 'WR', team: 'WAS', byeWeek: 14 },
  { name: 'Jahan Dotson', position: 'WR', team: 'WAS', byeWeek: 14 },
  { name: 'Luke McCaffrey', position: 'WR', team: 'WAS', byeWeek: 14 },
  { name: 'Zach Ertz', position: 'TE', team: 'WAS', byeWeek: 14 },
  { name: 'Austin Seibert', position: 'K', team: 'WAS', byeWeek: 14 },
  { name: 'Commanders Defense', position: 'DEF', team: 'WAS', byeWeek: 14 },
];

async function main() {
  console.log('Seeding NFL player data...');

  const existing = await prisma.player.count();
  if (existing > 0) {
    console.log(`Database already has ${existing} players — skipping seed.`);
    return;
  }

  // Insert in batches to avoid overwhelming the connection
  const BATCH_SIZE = 50;
  let inserted = 0;

  for (let i = 0; i < PLAYERS.length; i += BATCH_SIZE) {
    const batch = PLAYERS.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((player) =>
        prisma.player.create({
          data: {
            name: player.name,
            position: player.position,
            team: player.team,
            byeWeek: player.byeWeek,
            externalIds: player.externalIds ?? {},
          },
        }),
      ),
    );
    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${PLAYERS.length} players`);
  }

  console.log(`\n✅ Seeded ${inserted} NFL players.`);

  // ── ProjectionRankings (consensus half-PPR) ──────────────────────
  console.log('\nSeeding consensus rankings...');

  const allPlayers = await prisma.player.findMany({ select: { id: true, name: true, position: true } });
  const nameToId = new Map(allPlayers.map((p) => [p.name, p.id]));

  // Top ~120 consensus half-PPR rankings for 2026
  const rankings: { name: string; rank: number; projectedPoints: number }[] = [
    { name: 'Christian McCaffrey', rank: 1, projectedPoints: 320 },
    { name: 'Ja\'Marr Chase', rank: 2, projectedPoints: 280 },
    { name: 'Tyreek Hill', rank: 3, projectedPoints: 270 },
    { name: 'CeeDee Lamb', rank: 4, projectedPoints: 268 },
    { name: 'Justin Jefferson', rank: 5, projectedPoints: 265 },
    { name: 'Bijan Robinson', rank: 6, projectedPoints: 260 },
    { name: 'Amon-Ra St. Brown', rank: 7, projectedPoints: 255 },
    { name: 'Josh Allen', rank: 8, projectedPoints: 340 },
    { name: 'Patrick Mahomes', rank: 9, projectedPoints: 330 },
    { name: 'Jalen Hurts', rank: 10, projectedPoints: 325 },
    { name: 'Lamar Jackson', rank: 11, projectedPoints: 320 },
    { name: 'Saquon Barkley', rank: 12, projectedPoints: 245 },
    { name: 'Puka Nacua', rank: 13, projectedPoints: 240 },
    { name: 'A.J. Brown', rank: 14, projectedPoints: 238 },
    { name: 'Garrett Wilson', rank: 15, projectedPoints: 235 },
    { name: 'Marvin Harrison Jr.', rank: 16, projectedPoints: 232 },
    { name: 'Davante Adams', rank: 17, projectedPoints: 230 },
    { name: 'Travis Kelce', rank: 18, projectedPoints: 210 },
    { name: 'Sam LaPorta', rank: 19, projectedPoints: 205 },
    { name: 'Trey McBride', rank: 20, projectedPoints: 200 },
    { name: 'Breece Hall', rank: 21, projectedPoints: 225 },
    { name: 'Kyren Williams', rank: 22, projectedPoints: 220 },
    { name: 'Jonathan Taylor', rank: 23, projectedPoints: 218 },
    { name: 'Derrick Henry', rank: 24, projectedPoints: 215 },
    { name: 'Jahmyr Gibbs', rank: 25, projectedPoints: 210 },
    { name: 'Cooper Kupp', rank: 26, projectedPoints: 215 },
    { name: 'DK Metcalf', rank: 27, projectedPoints: 210 },
    { name: 'Deebo Samuel', rank: 28, projectedPoints: 208 },
    { name: 'Mike Evans', rank: 29, projectedPoints: 205 },
    { name: 'Brandon Aiyuk', rank: 30, projectedPoints: 202 },
    { name: 'Nico Collins', rank: 31, projectedPoints: 200 },
    { name: 'DJ Moore', rank: 32, projectedPoints: 198 },
    { name: 'Jaylen Waddle', rank: 33, projectedPoints: 195 },
    { name: 'DeVonta Smith', rank: 34, projectedPoints: 192 },
    { name: 'Chris Olave', rank: 35, projectedPoints: 190 },
    { name: 'George Kittle', rank: 36, projectedPoints: 185 },
    { name: 'Dalton Kincaid', rank: 37, projectedPoints: 180 },
    { name: 'Mark Andrews', rank: 38, projectedPoints: 175 },
    { name: 'Kyle Pitts', rank: 39, projectedPoints: 170 },
    { name: 'Joe Burrow', rank: 40, projectedPoints: 290 },
    { name: 'C.J. Stroud', rank: 41, projectedPoints: 285 },
    { name: 'Kyler Murray', rank: 42, projectedPoints: 275 },
    { name: 'Brock Purdy', rank: 43, projectedPoints: 270 },
    { name: 'Dak Prescott', rank: 44, projectedPoints: 265 },
    { name: 'Justin Herbert', rank: 45, projectedPoints: 260 },
    { name: 'Jordan Love', rank: 46, projectedPoints: 255 },
    { name: 'Caleb Williams', rank: 47, projectedPoints: 250 },
    { name: 'Anthony Richardson', rank: 48, projectedPoints: 245 },
    { name: 'Tua Tagovailoa', rank: 49, projectedPoints: 240 },
    { name: 'Jared Goff', rank: 50, projectedPoints: 235 },
    { name: 'Drake London', rank: 51, projectedPoints: 185 },
    { name: 'Zay Flowers', rank: 52, projectedPoints: 182 },
    { name: 'Brian Thomas Jr.', rank: 53, projectedPoints: 180 },
    { name: 'Malik Nabers', rank: 54, projectedPoints: 178 },
    { name: 'Rome Odunze', rank: 55, projectedPoints: 175 },
    { name: 'Tee Higgins', rank: 56, projectedPoints: 172 },
    { name: 'Stefon Diggs', rank: 57, projectedPoints: 170 },
    { name: 'Amari Cooper', rank: 58, projectedPoints: 168 },
    { name: 'Terry McLaurin', rank: 59, projectedPoints: 165 },
    { name: 'James Cook', rank: 60, projectedPoints: 195 },
    { name: 'Josh Jacobs', rank: 61, projectedPoints: 192 },
    { name: 'Joe Mixon', rank: 62, projectedPoints: 190 },
    { name: 'Travis Etienne', rank: 63, projectedPoints: 188 },
    { name: 'David Montgomery', rank: 64, projectedPoints: 185 },
    { name: 'Isiah Pacheco', rank: 65, projectedPoints: 182 },
    { name: 'Rachaad White', rank: 66, projectedPoints: 180 },
    { name: 'Kenneth Walker III', rank: 67, projectedPoints: 178 },
    { name: 'Aaron Jones', rank: 68, projectedPoints: 175 },
    { name: 'Najee Harris', rank: 69, projectedPoints: 173 },
    { name: 'Alvin Kamara', rank: 70, projectedPoints: 170 },
    { name: 'Rhamondre Stevenson', rank: 71, projectedPoints: 168 },
    { name: 'Tony Pollard', rank: 72, projectedPoints: 165 },
    { name: 'Zamir White', rank: 73, projectedPoints: 162 },
    { name: 'De\'Von Achane', rank: 74, projectedPoints: 160 },
    { name: 'Jayden Reed', rank: 75, projectedPoints: 158 },
    { name: 'Rashee Rice', rank: 76, projectedPoints: 155 },
    { name: 'George Pickens', rank: 77, projectedPoints: 152 },
    { name: 'Christian Watson', rank: 78, projectedPoints: 150 },
    { name: 'Khalil Shakir', rank: 79, projectedPoints: 148 },
    { name: 'Ladd McConkey', rank: 80, projectedPoints: 145 },
    { name: 'Xavier Worthy', rank: 81, projectedPoints: 142 },
    { name: 'Jakobi Meyers', rank: 82, projectedPoints: 140 },
    { name: 'Tyler Lockett', rank: 83, projectedPoints: 138 },
    { name: 'Jaxon Smith-Njigba', rank: 84, projectedPoints: 135 },
    { name: 'Courtland Sutton', rank: 85, projectedPoints: 132 },
    { name: 'Brock Bowers', rank: 86, projectedPoints: 160 },
    { name: 'Evan Engram', rank: 87, projectedPoints: 155 },
    { name: 'Dalton Schultz', rank: 88, projectedPoints: 150 },
    { name: 'T.J. Hockenson', rank: 89, projectedPoints: 145 },
    { name: 'Jake Ferguson', rank: 90, projectedPoints: 140 },
    { name: 'David Njoku', rank: 91, projectedPoints: 138 },
    { name: 'Cole Kmet', rank: 92, projectedPoints: 135 },
    { name: 'Pat Freiermuth', rank: 93, projectedPoints: 130 },
    { name: 'Baker Mayfield', rank: 94, projectedPoints: 230 },
    { name: 'Matthew Stafford', rank: 95, projectedPoints: 225 },
    { name: 'Aaron Rodgers', rank: 96, projectedPoints: 220 },
    { name: 'Geno Smith', rank: 97, projectedPoints: 215 },
    { name: 'Deshaun Watson', rank: 98, projectedPoints: 210 },
    { name: 'Will Levis', rank: 99, projectedPoints: 200 },
    { name: 'Daniel Jones', rank: 100, projectedPoints: 195 },
    { name: 'Bryce Young', rank: 101, projectedPoints: 190 },
    { name: 'Derek Carr', rank: 102, projectedPoints: 185 },
    { name: 'Russell Wilson', rank: 103, projectedPoints: 180 },
    { name: 'Sam Darnold', rank: 104, projectedPoints: 175 },
    { name: 'Gardner Minshew', rank: 105, projectedPoints: 170 },
    { name: 'Chuba Hubbard', rank: 106, projectedPoints: 155 },
    { name: 'Zach Charbonnet', rank: 107, projectedPoints: 150 },
    { name: 'Jaylen Warren', rank: 108, projectedPoints: 148 },
    { name: 'Tyjae Spears', rank: 109, projectedPoints: 145 },
    { name: 'Gus Edwards', rank: 110, projectedPoints: 142 },
    { name: 'J.K. Dobbins', rank: 111, projectedPoints: 140 },
    { name: 'Justice Hill', rank: 112, projectedPoints: 135 },
    { name: 'D\'Andre Swift', rank: 113, projectedPoints: 175 },
    { name: 'Chase Brown', rank: 114, projectedPoints: 165 },
    { name: 'Tank Bigsby', rank: 115, projectedPoints: 130 },
    { name: 'Blake Corum', rank: 116, projectedPoints: 125 },
    { name: 'Braelon Allen', rank: 117, projectedPoints: 120 },
    { name: 'Ray Davis', rank: 118, projectedPoints: 115 },
    { name: 'Jerome Ford', rank: 119, projectedPoints: 112 },
    { name: 'Tyler Allgeier', rank: 120, projectedPoints: 110 },
  ];

  const seasonId = '2026';
  const scoringType = 'half_ppr';
  let rankingInserted = 0;

  for (const r of rankings) {
    const playerId = nameToId.get(r.name);
    if (!playerId) {
      console.warn(`  ⚠ No player found for ranking: ${r.name}`);
      continue;
    }
    await prisma.projectionRanking.create({
      data: {
        playerId,
        seasonId,
        scoringType,
        rank: r.rank,
        projectedPoints: r.projectedPoints,
      },
    });
    rankingInserted++;
  }

  console.log(`✅ Seeded ${rankingInserted} consensus rankings (half-PPR).`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

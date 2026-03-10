// Crossword puzzle data — exported via window.CrosswordPuzzles
// Schema: { id, size, title, grid (2D, "#" = black), clues: { across[], down[] } }
// Each clue: { num, row, col, text, answer }

window.CrosswordPuzzles = {
  easy: [
    {
      id: "easy-001",
      size: 5,
      title: "Quick Start",
      grid: [
        ["S","T","A","R","S"],
        ["L","#","B","#","H"],
        ["A","R","O","S","E"],
        ["M","#","V","#","D"],
        ["S","P","E","N","D"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 0, text: "Celestial bodies", answer: "STARS" },
          { num: 4, row: 2, col: 0, text: "Got up from bed", answer: "AROSE" },
          { num: 6, row: 4, col: 0, text: "Use money", answer: "SPEND" }
        ],
        down: [
          { num: 1, row: 0, col: 0, text: "Grand ___ (basketball move)", answer: "SLAMS" },
          { num: 2, row: 0, col: 2, text: "Higher than; on top of", answer: "ABOVE" },
          { num: 3, row: 0, col: 4, text: "Tool storage building", answer: "SHEDS" },
          { num: 5, row: 2, col: 3, text: "Writing instrument tip", answer: "NIN" }
        ]
      }
    },
    {
      id: "easy-002",
      size: 5,
      title: "Morning Brew",
      grid: [
        ["G","R","I","N","D"],
        ["R","#","#","O","#"],
        ["A","R","O","M","A"],
        ["B","#","#","E","#"],
        ["S","T","E","E","P"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 0, text: "Crush beans for coffee", answer: "GRIND" },
          { num: 4, row: 2, col: 0, text: "A pleasant smell", answer: "AROMA" },
          { num: 6, row: 4, col: 0, text: "Soak tea in hot water", answer: "STEEP" }
        ],
        down: [
          { num: 1, row: 0, col: 0, text: "Seize; take hold of", answer: "GRABS" },
          { num: 2, row: 0, col: 3, text: "Given a title; called", answer: "NOMEE" },
          { num: 3, row: 2, col: 1, text: "Shakespeare's King ___", answer: "R" },
          { num: 5, row: 2, col: 4, text: "Like a cliff edge", answer: "AEP" }
        ]
      }
    },
    {
      id: "easy-003",
      size: 5,
      title: "Pet Shop",
      grid: [
        ["C","L","A","S","P"],
        ["A","#","N","#","E"],
        ["T","R","A","I","L"],
        ["S","#","L","#","T"],
        ["F","L","O","O","R"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 0, text: "Fasten; hold tightly", answer: "CLASP" },
          { num: 4, row: 2, col: 0, text: "A hiking path", answer: "TRAIL" },
          { num: 6, row: 4, col: 0, text: "Walk on this surface", answer: "FLOOR" }
        ],
        down: [
          { num: 1, row: 0, col: 0, text: "Feline companions", answer: "CATS" },
          { num: 2, row: 0, col: 2, text: "Opposite of digital", answer: "ANALO" },
          { num: 3, row: 0, col: 4, text: "Animal fur or coat", answer: "PELTR" },
          { num: 5, row: 2, col: 3, text: "Pronoun for a thing", answer: "IOT" }
        ]
      }
    }
  ],

  medium: [
    {
      id: "med-001",
      size: 9,
      title: "At the Movies",
      grid: [
        ["S","C","R","E","E","N","#","A","B"],
        ["T","#","O","#","X","#","S","#","A"],
        ["A","C","L","E","I","S","T","A","R"],
        ["G","#","E","#","T","#","A","#","#"],
        ["E","N","S","E","M","B","L","E","#"],
        ["#","#","#","#","#","#","L","#","C"],
        ["S","C","O","R","E","#","S","P","A"],
        ["E","#","#","E","#","#","#","L","#"],
        ["T","R","A","I","L","E","R","O","T"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 0, text: "Silver ___; where movies are shown", answer: "SCREEN" },
          { num: 5, row: 0, col: 7, text: "Start of the alphabet", answer: "AB" },
          { num: 7, row: 2, col: 0, text: "A lead performer in a film", answer: "CLEISTAR" },
          { num: 8, row: 4, col: 0, text: "A group of actors in a film", answer: "ENSEMBLE" },
          { num: 10, row: 6, col: 0, text: "Musical soundtrack of a film", answer: "SCORE" },
          { num: 12, row: 6, col: 6, text: "Health retreat", answer: "SPA" },
          { num: 13, row: 8, col: 0, text: "Movie preview clip", answer: "TRAILER" },
          { num: 14, row: 8, col: 7, text: "Abbreviation for overtime", answer: "OT" }
        ],
        down: [
          { num: 1, row: 0, col: 0, text: "Platform for actors", answer: "STAGE" },
          { num: 2, row: 0, col: 2, text: "Parts in a play or film", answer: "ROLES" },
          { num: 3, row: 0, col: 4, text: "Leave; go out of", answer: "EXIT" },
          { num: 4, row: 0, col: 7, text: "On a single occasion", answer: "A" },
          { num: 6, row: 0, col: 8, text: "Prohibition on trade", answer: "BAR" },
          { num: 9, row: 4, col: 1, text: "Abbreviation for note", answer: "N" },
          { num: 11, row: 6, col: 3, text: "Fishing rod holder", answer: "REI" },
          { num: 12, row: 6, col: 6, text: "Movie theater seats are in these", answer: "STALLS" },
          { num: 15, row: 6, col: 7, text: "Conspiracy; storyline", answer: "PLOT" }
        ]
      }
    }
  ],

  hard: [],
  extreme: []
};

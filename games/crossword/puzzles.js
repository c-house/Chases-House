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
        ["B","L","A","N","D"],
        ["R","#","B","#","W"],
        ["A","R","O","S","E"],
        ["S","#","V","#","L"],
        ["S","T","E","E","L"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 0, text: "Uninteresting; without flavor", answer: "BLAND" },
          { num: 4, row: 2, col: 0, text: "Got up from bed", answer: "AROSE" },
          { num: 5, row: 4, col: 0, text: "Strong alloy metal", answer: "STEEL" }
        ],
        down: [
          { num: 1, row: 0, col: 0, text: "Musical instrument section", answer: "BRASS" },
          { num: 2, row: 0, col: 2, text: "Higher than; over", answer: "ABOVE" },
          { num: 3, row: 0, col: 4, text: "To live or reside", answer: "DWELL" }
        ]
      }
    },
    {
      id: "easy-002",
      size: 5,
      title: "Mixed Bag",
      grid: [
        ["B","R","A","N","D"],
        ["A","#","V","#","R"],
        ["L","O","O","S","E"],
        ["S","#","I","#","A"],
        ["A","D","D","E","D"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 0, text: "A name or trademark", answer: "BRAND" },
          { num: 4, row: 2, col: 0, text: "Not tight; slack", answer: "LOOSE" },
          { num: 5, row: 4, col: 0, text: "Combined; put together", answer: "ADDED" }
        ],
        down: [
          { num: 1, row: 0, col: 0, text: "Lightweight wood for model building", answer: "BALSA" },
          { num: 2, row: 0, col: 2, text: "Steer clear of; keep away from", answer: "AVOID" },
          { num: 3, row: 0, col: 4, text: "To fear greatly; a feeling of anxiety", answer: "DREAD" }
        ]
      }
    }
  ],

  medium: [
    {
      id: "med-001",
      size: 9,
      title: "Learning",
      grid: [
        ["#","#","B","A","S","I","C","#","#"],
        ["#","#","#","#","T","#","#","#","#"],
        ["I","#","#","#","R","#","#","#","G"],
        ["N","#","#","#","U","#","#","#","E"],
        ["D","I","R","E","C","T","I","O","N"],
        ["E","#","#","#","T","#","#","#","R"],
        ["X","#","#","#","U","#","#","#","E"],
        ["#","#","#","#","R","#","#","#","#"],
        ["#","#","B","R","E","A","K","#","#"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 2, text: "Fundamental; elementary", answer: "BASIC" },
          { num: 5, row: 4, col: 0, text: "The way one faces or travels", answer: "DIRECTION" },
          { num: 6, row: 8, col: 2, text: "A pause; to shatter", answer: "BREAK" }
        ],
        down: [
          { num: 2, row: 0, col: 4, text: "The arrangement of parts in a building or system", answer: "STRUCTURE" },
          { num: 3, row: 2, col: 0, text: "Alphabetical listing at the back of a book", answer: "INDEX" },
          { num: 4, row: 2, col: 8, text: "A category of art or literature", answer: "GENRE" }
        ]
      }
    },
    {
      id: "med-002",
      size: 9,
      title: "Everyday",
      grid: [
        ["#","#","M","A","T","C","H","#","#"],
        ["#","#","#","#","E","#","#","#","#"],
        ["Q","#","#","#","L","#","#","#","O"],
        ["U","#","#","#","E","#","#","#","U"],
        ["E","Q","U","I","P","M","E","N","T"],
        ["E","#","#","#","H","#","#","#","E"],
        ["N","#","#","#","O","#","#","#","R"],
        ["#","#","#","#","N","#","#","#","#"],
        ["#","#","W","H","E","E","L","#","#"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 2, text: "A contest between opponents", answer: "MATCH" },
          { num: 5, row: 4, col: 0, text: "Tools or machinery needed for a task", answer: "EQUIPMENT" },
          { num: 6, row: 8, col: 2, text: "Circular frame that rotates on an axle", answer: "WHEEL" }
        ],
        down: [
          { num: 2, row: 0, col: 4, text: "Device for voice communication at a distance", answer: "TELEPHONE" },
          { num: 3, row: 2, col: 0, text: "A female monarch", answer: "QUEEN" },
          { num: 4, row: 2, col: 8, text: "Farther from the center; external", answer: "OUTER" }
        ]
      }
    }
  ],

  hard: [
    {
      id: "hard-001",
      size: 13,
      title: "Big Words",
      grid: [
        ["#","#","#","A","N","C","I","E","N","T","#","#","#"],
        ["#","#","#","#","#","O","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","M","#","#","#","#","#","#","#"],
        ["M","#","#","#","#","M","#","#","#","#","#","#","C"],
        ["I","#","#","#","#","U","#","#","#","#","#","#","O"],
        ["R","#","#","#","#","N","#","#","#","#","#","#","R"],
        ["A","D","M","I","N","I","S","T","R","A","T","O","R"],
        ["C","#","#","#","#","C","#","#","#","#","#","#","E"],
        ["L","#","#","#","#","A","#","#","#","#","#","#","C"],
        ["E","#","#","#","#","T","#","#","#","#","#","#","T"],
        ["#","#","#","#","#","I","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","O","#","#","#","#","#","#","#"],
        ["#","#","#","G","E","N","E","R","A","L","#","#","#"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 3, text: "Very old; from a long-ago era", answer: "ANCIENT" },
          { num: 5, row: 6, col: 0, text: "A person who manages an organization or system", answer: "ADMINISTRATOR" },
          { num: 6, row: 12, col: 3, text: "A military rank; not specific", answer: "GENERAL" }
        ],
        down: [
          { num: 2, row: 0, col: 5, text: "The exchange of information between people", answer: "COMMUNICATION" },
          { num: 3, row: 3, col: 0, text: "An extraordinary and welcome event", answer: "MIRACLE" },
          { num: 4, row: 3, col: 12, text: "Free from error; right", answer: "CORRECT" }
        ]
      }
    },
    {
      id: "hard-002",
      size: 13,
      title: "Concepts",
      grid: [
        ["#","#","#","J","O","U","R","N","E","Y","#","#","#"],
        ["#","#","#","#","#","N","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","D","#","#","#","#","#","#","#"],
        ["C","#","#","#","#","E","#","#","#","#","#","#","D"],
        ["A","#","#","#","#","R","#","#","#","#","#","#","I"],
        ["R","#","#","#","#","S","#","#","#","#","#","#","S"],
        ["E","N","T","E","R","T","A","I","N","M","E","N","T"],
        ["F","#","#","#","#","A","#","#","#","#","#","#","A"],
        ["U","#","#","#","#","N","#","#","#","#","#","#","N"],
        ["L","#","#","#","#","D","#","#","#","#","#","#","T"],
        ["#","#","#","#","#","I","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","N","#","#","#","#","#","#","#"],
        ["#","#","#","D","I","G","I","T","A","L","#","#","#"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 3, text: "A long trip or voyage", answer: "JOURNEY" },
          { num: 5, row: 6, col: 0, text: "Amusement from performances or shows", answer: "ENTERTAINMENT" },
          { num: 6, row: 12, col: 3, text: "Relating to computer technology", answer: "DIGITAL" }
        ],
        down: [
          { num: 2, row: 0, col: 5, text: "Comprehension; knowledge of a subject", answer: "UNDERSTANDING" },
          { num: 3, row: 3, col: 0, text: "Giving attention to avoid danger or mistakes", answer: "CAREFUL" },
          { num: 4, row: 3, col: 12, text: "Far away in space or time", answer: "DISTANT" }
        ]
      }
    }
  ],

  extreme: [
    {
      id: "ext-001",
      size: 15,
      title: "Workplace",
      grid: [
        ["#","#","#","#","T","E","A","C","H","E","R","#","#","#","#"],
        ["#","#","#","#","#","#","#","R","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","Y","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","S","#","#","#","#","#","#","#"],
        ["C","#","#","#","#","#","#","T","#","#","#","#","#","#","M"],
        ["O","#","#","#","#","#","#","A","#","#","#","#","#","#","O"],
        ["M","#","#","#","#","#","#","L","#","#","#","#","#","#","R"],
        ["P","E","R","S","O","N","A","L","I","Z","A","T","I","O","N"],
        ["A","#","#","#","#","#","#","I","#","#","#","#","#","#","I"],
        ["N","#","#","#","#","#","#","Z","#","#","#","#","#","#","N"],
        ["Y","#","#","#","#","#","#","A","#","#","#","#","#","#","G"],
        ["#","#","#","#","#","#","#","T","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","I","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","O","#","#","#","#","#","#","#"],
        ["#","#","#","#","E","V","E","N","I","N","G","#","#","#","#"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 4, text: "An educator who instructs students", answer: "TEACHER" },
          { num: 5, row: 7, col: 0, text: "Making something suit individual preferences", answer: "PERSONALIZATION" },
          { num: 6, row: 14, col: 4, text: "The period of time at the end of the day", answer: "EVENING" }
        ],
        down: [
          { num: 2, row: 0, col: 7, text: "The process of forming crystals from a solution", answer: "CRYSTALLIZATION" },
          { num: 3, row: 4, col: 0, text: "A commercial business or firm", answer: "COMPANY" },
          { num: 4, row: 4, col: 14, text: "The early part of the day, before noon", answer: "MORNING" }
        ]
      }
    },
    {
      id: "ext-002",
      size: 15,
      title: "Grand",
      grid: [
        ["#","#","#","#","M","O","N","A","R","C","H","#","#","#","#"],
        ["#","#","#","#","#","#","#","C","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","C","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","O","#","#","#","#","#","#","#"],
        ["B","#","#","#","#","#","#","M","#","#","#","#","#","#","K"],
        ["A","#","#","#","#","#","#","P","#","#","#","#","#","#","I"],
        ["L","#","#","#","#","#","#","L","#","#","#","#","#","#","N"],
        ["C","O","M","M","E","R","C","I","A","L","I","Z","I","N","G"],
        ["O","#","#","#","#","#","#","S","#","#","#","#","#","#","D"],
        ["N","#","#","#","#","#","#","H","#","#","#","#","#","#","O"],
        ["Y","#","#","#","#","#","#","M","#","#","#","#","#","#","M"],
        ["#","#","#","#","#","#","#","E","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","N","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","T","#","#","#","#","#","#","#"],
        ["#","#","#","#","M","O","N","S","T","E","R","#","#","#","#"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 4, text: "A ruler or sovereign", answer: "MONARCH" },
          { num: 5, row: 7, col: 0, text: "Turning something into a commercial product", answer: "COMMERCIALIZING" },
          { num: 6, row: 14, col: 4, text: "A large, frightening creature", answer: "MONSTER" }
        ],
        down: [
          { num: 2, row: 0, col: 7, text: "Things that have been achieved successfully", answer: "ACCOMPLISHMENTS" },
          { num: 3, row: 4, col: 0, text: "A platform projecting from a building wall", answer: "BALCONY" },
          { num: 4, row: 4, col: 14, text: "A realm ruled by a king or queen", answer: "KINGDOM" }
        ]
      }
    }
  ]
};

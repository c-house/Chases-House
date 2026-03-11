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
    },
    {
      id: "easy-003",
      size: 5,
      title: "Winter Morning",
      grid: [
        ["F","R","O","S","T"],
        ["A","#","U","#","I"],
        ["L","I","N","E","R"],
        ["L","#","C","#","E"],
        ["S","E","E","D","S"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 0, text: "Thin ice crystals on a cold morning", answer: "FROST" },
          { num: 4, row: 2, col: 0, text: "A large passenger ship", answer: "LINER" },
          { num: 5, row: 4, col: 0, text: "Plant these in soil to grow flowers", answer: "SEEDS" }
        ],
        down: [
          { num: 1, row: 0, col: 0, text: "Niagara, for example", answer: "FALLS" },
          { num: 2, row: 0, col: 2, text: "A unit of weight; one-sixteenth of a pound", answer: "OUNCE" },
          { num: 3, row: 0, col: 4, text: "Rubber coverings on wheels", answer: "TIRES" }
        ]
      }
    },
    {
      id: "easy-004",
      size: 5,
      title: "Around the House",
      grid: [
        ["C","H","A","I","R"],
        ["R","#","L","#","I"],
        ["O","N","I","O","N"],
        ["N","#","V","#","G"],
        ["E","V","E","N","S"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 0, text: "A piece of furniture for sitting", answer: "CHAIR" },
          { num: 4, row: 2, col: 0, text: "Layered vegetable that can make you cry", answer: "ONION" },
          { num: 5, row: 4, col: 0, text: "Makes level or equal", answer: "EVENS" }
        ],
        down: [
          { num: 1, row: 0, col: 0, text: "An old woman in fairy tales", answer: "CRONE" },
          { num: 2, row: 0, col: 2, text: "Living; not dead", answer: "ALIVE" },
          { num: 3, row: 0, col: 4, text: "Circular bands worn on fingers", answer: "RINGS" }
        ]
      }
    },
    {
      id: "easy-005",
      size: 5,
      title: "Sweet and Simple",
      grid: [
        ["B","R","A","V","E"],
        ["E","#","B","#","X"],
        ["A","B","O","V","E"],
        ["D","#","D","#","R"],
        ["S","W","E","E","T"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 0, text: "Showing courage; not afraid", answer: "BRAVE" },
          { num: 4, row: 2, col: 0, text: "Higher than; overhead", answer: "ABOVE" },
          { num: 5, row: 4, col: 0, text: "Tasting like sugar", answer: "SWEET" }
        ],
        down: [
          { num: 1, row: 0, col: 0, text: "Small round objects on a string", answer: "BEADS" },
          { num: 2, row: 0, col: 2, text: "A place where someone lives", answer: "ABODE" },
          { num: 3, row: 0, col: 4, text: "To put forth effort or force", answer: "EXERT" }
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
    },
    {
      id: "med-003",
      size: 9,
      title: "On the Move",
      grid: [
        ["#","#","P","L","A","C","E","#","#"],
        ["#","#","#","#","T","#","#","#","#"],
        ["D","#","#","#","T","#","#","#","S"],
        ["R","#","#","#","E","#","#","#","W"],
        ["A","D","V","E","N","T","U","R","E"],
        ["F","#","#","#","T","#","#","#","E"],
        ["T","#","#","#","I","#","#","#","P"],
        ["#","#","#","#","O","#","#","#","#"],
        ["#","#","S","I","N","C","E","#","#"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 2, text: "Setting for a race, or what you do with a bet", answer: "PLACE" },
          { num: 5, row: 4, col: 0, text: "Thrilling journey into the unknown", answer: "ADVENTURE" },
          { num: 6, row: 8, col: 2, text: "From that time forward, or because", answer: "SINCE" }
        ],
        down: [
          { num: 2, row: 0, col: 4, text: "What a teacher demands and a phone steals", answer: "ATTENTION" },
          { num: 3, row: 2, col: 0, text: "First version of a document, or a chilly gust", answer: "DRAFT" },
          { num: 4, row: 2, col: 8, text: "Clean the floor, or win every game in a series", answer: "SWEEP" }
        ]
      }
    },
    {
      id: "med-004",
      size: 9,
      title: "Number Cruncher",
      grid: [
        ["#","#","S","A","C","K","S","#","#"],
        ["#","#","#","#","O","#","#","#","#"],
        ["B","#","#","#","M","#","#","#","C"],
        ["A","#","#","#","M","#","#","#","R"],
        ["C","A","L","C","U","L","A","T","E"],
        ["O","#","#","#","N","#","#","#","E"],
        ["N","#","#","#","I","#","#","#","K"],
        ["#","#","#","#","T","#","#","#","#"],
        ["#","#","R","O","Y","A","L","#","#"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 2, text: "What you get when you're fired, or large bags", answer: "SACKS" },
          { num: 5, row: 4, col: 0, text: "Work out the numbers; figure it out", answer: "CALCULATE" },
          { num: 6, row: 8, col: 2, text: "Fit for a king; the flush that beats four of a kind", answer: "ROYAL" }
        ],
        down: [
          { num: 2, row: 0, col: 4, text: "A group that shares a neighborhood or interest", answer: "COMMUNITY" },
          { num: 3, row: 2, col: 0, text: "Sizzling breakfast staple from a pig", answer: "BACON" },
          { num: 4, row: 2, col: 8, text: "Small stream; up one without a paddle", answer: "CREEK" }
        ]
      }
    },
    {
      id: "med-005",
      size: 9,
      title: "Sharp Eye",
      grid: [
        ["#","#","F","O","C","U","S","#","#"],
        ["#","#","#","#","O","#","#","#","#"],
        ["S","#","#","#","R","#","#","#","W"],
        ["L","#","#","#","P","#","#","#","H"],
        ["E","L","A","B","O","R","A","T","E"],
        ["E","#","#","#","R","#","#","#","E"],
        ["P","#","#","#","A","#","#","#","L"],
        ["#","#","#","#","T","#","#","#","#"],
        ["#","#","C","L","E","A","R","#","#"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 2, text: "Adjust the lens, or keep your eye on the ball", answer: "FOCUS" },
          { num: 5, row: 4, col: 0, text: "To expand on an idea, or ornately detailed", answer: "ELABORATE" },
          { num: 6, row: 8, col: 2, text: "Transparent; easy to understand", answer: "CLEAR" }
        ],
        down: [
          { num: 2, row: 0, col: 4, text: "Relating to big business; a ladder worth climbing", answer: "CORPORATE" },
          { num: 3, row: 2, col: 0, text: "Nightly reset; what you lose counting sheep", answer: "SLEEP" },
          { num: 4, row: 2, col: 8, text: "Invention that really got things rolling", answer: "WHEEL" }
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
    },
    {
      id: "hard-003",
      size: 13,
      title: "Fired Up",
      grid: [
        ["#","#","#","C","E","R","A","M","I","C","#","#","#"],
        ["#","#","#","#","#","#","D","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","V","#","#","#","#","#","#"],
        ["L","#","#","#","#","#","E","#","#","#","#","#","F"],
        ["E","#","#","#","#","#","R","#","#","#","#","#","U"],
        ["A","#","#","#","#","#","T","#","#","#","#","#","R"],
        ["D","E","T","E","R","M","I","N","A","T","I","O","N"],
        ["I","#","#","#","#","#","S","#","#","#","#","#","A"],
        ["N","#","#","#","#","#","E","#","#","#","#","#","C"],
        ["G","#","#","#","#","#","M","#","#","#","#","#","E"],
        ["#","#","#","#","#","#","E","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","N","#","#","#","#","#","#"],
        ["#","#","#","W","E","S","T","E","R","N","#","#","#"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 3, text: "Survives the kiln but not the kitchen floor", answer: "CERAMIC" },
          { num: 5, row: 6, col: 0, text: "Stubbornness with a positive spin", answer: "DETERMINATION" },
          { num: 6, row: 12, col: 3, text: "Film genre where the hat matters more than the plot", answer: "WESTERN" }
        ],
        down: [
          { num: 2, row: 0, col: 6, text: "It interrupts your favorite show at the worst moment", answer: "ADVERTISEMENT" },
          { num: 3, row: 3, col: 0, text: "First in line, or what a loaded question does", answer: "LEADING" },
          { num: 4, row: 3, col: 12, text: "Basement beast that eats gas and breathes heat", answer: "FURNACE" }
        ]
      }
    },
    {
      id: "hard-004",
      size: 13,
      title: "Close Enough",
      grid: [
        ["#","#","#","B","A","L","A","N","C","E","#","#","#"],
        ["#","#","#","#","#","#","P","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","P","#","#","#","#","#","#"],
        ["C","#","#","#","#","#","R","#","#","#","#","#","C"],
        ["A","#","#","#","#","#","O","#","#","#","#","#","H"],
        ["B","#","#","#","#","#","X","#","#","#","#","#","A"],
        ["I","N","V","E","S","T","I","G","A","T","I","O","N"],
        ["N","#","#","#","#","#","M","#","#","#","#","#","N"],
        ["E","#","#","#","#","#","A","#","#","#","#","#","E"],
        ["T","#","#","#","#","#","T","#","#","#","#","#","L"],
        ["#","#","#","#","#","#","E","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","L","#","#","#","#","#","#"],
        ["#","#","#","P","L","A","Y","I","N","G","#","#","#"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 3, text: "What you lose on ice and need in your checkbook", answer: "BALANCE" },
          { num: 5, row: 6, col: 0, text: "Official poking around when something doesn't add up", answer: "INVESTIGATION" },
          { num: 6, row: 12, col: 3, text: "What musicians and children have in common", answer: "PLAYING" }
        ],
        down: [
          { num: 2, row: 0, col: 6, text: "Close enough for horseshoes and hand grenades", answer: "APPROXIMATELY" },
          { num: 3, row: 3, col: 0, text: "Where ministers convene and dishes sleep", answer: "CABINET" },
          { num: 4, row: 3, col: 12, text: "Flip through these, or swim across the English one", answer: "CHANNEL" }
        ]
      }
    },
    {
      id: "hard-005",
      size: 13,
      title: "Deep Thought",
      grid: [
        ["#","#","#","S","T","U","D","E","N","T","#","#","#"],
        ["#","#","#","#","#","#","E","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","M","#","#","#","#","#","#"],
        ["V","#","#","#","#","#","O","#","#","#","#","#","C"],
        ["O","#","#","#","#","#","N","#","#","#","#","#","O"],
        ["L","#","#","#","#","#","S","#","#","#","#","#","R"],
        ["C","O","N","C","E","N","T","R","A","T","I","O","N"],
        ["A","#","#","#","#","#","R","#","#","#","#","#","E"],
        ["N","#","#","#","#","#","A","#","#","#","#","#","R"],
        ["O","#","#","#","#","#","T","#","#","#","#","#","S"],
        ["#","#","#","#","#","#","I","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","O","#","#","#","#","#","#"],
        ["#","#","#","C","O","U","N","T","R","Y","#","#","#"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 3, text: "Perpetual learner, often in debt", answer: "STUDENT" },
          { num: 5, row: 6, col: 0, text: "The art of ignoring everything except this clue", answer: "CONCENTRATION" },
          { num: 6, row: 12, col: 3, text: "Place with more cows than taxis", answer: "COUNTRY" }
        ],
        down: [
          { num: 2, row: 0, col: 6, text: "Either proving a theorem or blocking a street", answer: "DEMONSTRATION" },
          { num: 3, row: 3, col: 0, text: "Mountain with anger management issues", answer: "VOLCANO" },
          { num: 4, row: 3, col: 12, text: "Where spiders and boxers both go to rest", answer: "CORNERS" }
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
    },
    {
      id: "ext-003",
      size: 15,
      title: "Lab Notes",
      grid: [
        ["#","#","#","#","O","U","T","C","O","M","E","#","#","#","#"],
        ["#","#","#","#","#","#","#","H","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","A","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","R","#","#","#","#","#","#","#"],
        ["M","#","#","#","#","#","#","A","#","#","#","#","#","#","T"],
        ["I","#","#","#","#","#","#","C","#","#","#","#","#","#","H"],
        ["N","#","#","#","#","#","#","T","#","#","#","#","#","#","U"],
        ["E","X","P","E","R","I","M","E","N","T","A","T","I","O","N"],
        ["R","#","#","#","#","#","#","R","#","#","#","#","#","#","D"],
        ["A","#","#","#","#","#","#","I","#","#","#","#","#","#","E"],
        ["L","#","#","#","#","#","#","S","#","#","#","#","#","#","R"],
        ["#","#","#","#","#","#","#","T","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","I","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","C","#","#","#","#","#","#","#"],
        ["#","#","#","#","O","D","Y","S","S","E","Y","#","#","#","#"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 4, text: "Result you only see after coming out of something", answer: "OUTCOME" },
          { num: 5, row: 7, col: 0, text: "Trial and error, heavy on the latter", answer: "EXPERIMENTATION" },
          { num: 6, row: 14, col: 4, text: "Homer wrote one; Honda sold another", answer: "ODYSSEY" }
        ],
        down: [
          { num: 2, row: 0, col: 7, text: "Distinctive marks — peculiarly, this answer has fifteen letters", answer: "CHARACTERISTICS" },
          { num: 3, row: 4, col: 0, text: "Rock's more refined cousin, found in vitamins", answer: "MINERAL" },
          { num: 4, row: 4, col: 14, text: "Zeus's favorite percussion instrument", answer: "THUNDER" }
        ]
      }
    },
    {
      id: "ext-004",
      size: 15,
      title: "Glossary",
      grid: [
        ["#","#","#","#","C","A","T","A","L","O","G","#","#","#","#"],
        ["#","#","#","#","#","#","#","C","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","K","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","N","#","#","#","#","#","#","#"],
        ["M","#","#","#","#","#","#","O","#","#","#","#","#","#","C"],
        ["O","#","#","#","#","#","#","W","#","#","#","#","#","#","A"],
        ["N","#","#","#","#","#","#","L","#","#","#","#","#","#","P"],
        ["I","N","T","E","R","P","R","E","T","A","T","I","O","N","S"],
        ["T","#","#","#","#","#","#","D","#","#","#","#","#","#","U"],
        ["O","#","#","#","#","#","#","G","#","#","#","#","#","#","L"],
        ["R","#","#","#","#","#","#","E","#","#","#","#","#","#","E"],
        ["#","#","#","#","#","#","#","M","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","E","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","N","#","#","#","#","#","#","#"],
        ["#","#","#","#","A","M","A","T","E","U","R","#","#","#","#"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 4, text: "Library's index or IKEA's weapon of mass consumption", answer: "CATALOG" },
          { num: 5, row: 7, col: 0, text: "Multiple readings of one text — a lit professor's specialty", answer: "INTERPRETATIONS" },
          { num: 6, row: 14, col: 4, text: "French for 'lover'; English for 'unpaid'", answer: "AMATEUR" }
        ],
        down: [
          { num: 2, row: 0, col: 7, text: "Fifteen letters for saying 'message received'", answer: "ACKNOWLEDGEMENT" },
          { num: 3, row: 4, col: 0, text: "Komodo dragon or desktop screen — both just stare at you", answer: "MONITOR" },
          { num: 4, row: 4, col: 14, text: "Time's vessel, or a bitter pill to swallow", answer: "CAPSULE" }
        ]
      }
    },
    {
      id: "ext-005",
      size: 15,
      title: "In Bloom",
      grid: [
        ["#","#","#","#","S","P","A","R","R","O","W","#","#","#","#"],
        ["#","#","#","#","#","#","#","E","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","C","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","O","#","#","#","#","#","#","#"],
        ["V","#","#","#","#","#","#","M","#","#","#","#","#","#","B"],
        ["I","#","#","#","#","#","#","M","#","#","#","#","#","#","L"],
        ["B","#","#","#","#","#","#","E","#","#","#","#","#","#","O"],
        ["R","E","P","R","E","S","E","N","T","A","T","I","V","E","S"],
        ["A","#","#","#","#","#","#","D","#","#","#","#","#","#","S"],
        ["N","#","#","#","#","#","#","A","#","#","#","#","#","#","O"],
        ["T","#","#","#","#","#","#","T","#","#","#","#","#","#","M"],
        ["#","#","#","#","#","#","#","I","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","O","#","#","#","#","#","#","#"],
        ["#","#","#","#","#","#","#","N","#","#","#","#","#","#","#"],
        ["#","#","#","#","P","U","R","S","U","I","T","#","#","#","#"]
      ],
      clues: {
        across: [
          { num: 1, row: 0, col: 4, text: "Captain Jack's surname; a humble brown songbird", answer: "SPARROW" },
          { num: 5, row: 7, col: 0, text: "Elected to speak for you, rarely to listen", answer: "REPRESENTATIVES" },
          { num: 6, row: 14, col: 4, text: "The chase after happiness, per Jefferson's edit", answer: "PURSUIT" }
        ],
        down: [
          { num: 2, row: 0, col: 7, text: "Netflix's are algorithmic; your doctor's are mandatory", answer: "RECOMMENDATIONS" },
          { num: 3, row: 4, col: 0, text: "Pulsing with energy; what beige will never be", answer: "VIBRANT" },
          { num: 4, row: 4, col: 14, text: "Trees do it in spring; a '90s sitcom did it for five seasons", answer: "BLOSSOM" }
        ]
      }
    }
  ]
};

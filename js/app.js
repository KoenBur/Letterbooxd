// ─── STATE ──────────────────────────────────────────────────────────────
const state = {
  username: localStorage.getItem('lbx_username') || 'Reader',
  readBooks: JSON.parse(localStorage.getItem('lbx_read') || '{}'),
  ratings: JSON.parse(localStorage.getItem('lbx_ratings') || '{}'),
  favorites: JSON.parse(localStorage.getItem('lbx_favorites') || '[]'),
  currentPage: 'home',
  currentBook: null,
  currentList: null,
  searchQuery: '',
  searchResults: [],
  popularBooks: [],
  classicsBooks: [],
  fictionBooks: [],
  pendingRatingBook: null,
};

function save() {
  localStorage.setItem('lbx_read', JSON.stringify(state.readBooks));
  localStorage.setItem('lbx_ratings', JSON.stringify(state.ratings));
  localStorage.setItem('lbx_favorites', JSON.stringify(state.favorites));
  localStorage.setItem('lbx_username', state.username);
}

// ─── CURATED LISTS DATA ──────────────────────────────────────────────────
const CURATED_LISTS = {
  lemonde: {
    title: "Le Monde's 100 Books of the Century",
    source: "Le Monde",
    year: "1999",
    desc: "In 1999, the French newspaper Le Monde asked its readers to vote for the greatest books of the 20th century. The result was a fascinating cross-section of world literature.",
    books: [
      { title: "In Search of Lost Time", author: "Marcel Proust" },
      { title: "The Trial", author: "Franz Kafka" },
      { title: "Journey to the End of the Night", author: "Louis-Ferdinand Céline" },
      { title: "The Stranger", author: "Albert Camus" },
      { title: "Ulysses", author: "James Joyce" },
      { title: "The Little Prince", author: "Antoine de Saint-Exupéry" },
      { title: "One Hundred Years of Solitude", author: "Gabriel García Márquez" },
      { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
      { title: "The Sound and the Fury", author: "William Faulkner" },
      { title: "Brave New World", author: "Aldous Huxley" },
      { title: "The Master and Margarita", author: "Mikhail Bulgakov" },
      { title: "The Grapes of Wrath", author: "John Steinbeck" },
      { title: "Lolita", author: "Vladimir Nabokov" },
      { title: "The Plague", author: "Albert Camus" },
      { title: "Nausea", author: "Jean-Paul Sartre" },
      { title: "Waiting for Godot", author: "Samuel Beckett" },
      { title: "The Tin Drum", author: "Günter Grass" },
      { title: "The Old Man and the Sea", author: "Ernest Hemingway" },
      { title: "Lord of the Flies", author: "William Golding" },
      { title: "Nineteen Eighty-Four", author: "George Orwell" },
      { title: "For Whom the Bell Tolls", author: "Ernest Hemingway" },
      { title: "The Name of the Rose", author: "Umberto Eco" },
      { title: "Gone with the Wind", author: "Margaret Mitchell" },
      { title: "The Diary of a Young Girl", author: "Anne Frank" },
      { title: "The Second Sex", author: "Simone de Beauvoir" },
      { title: "If This Is a Man", author: "Primo Levi" },
      { title: "The Leopard", author: "Giuseppe Tomasi di Lampedusa" },
      { title: "Doctor Zhivago", author: "Boris Pasternak" },
      { title: "The Tropic of Cancer", author: "Henry Miller" },
      { title: "Man's Fate", author: "André Malraux" },
      { title: "Being and Nothingness", author: "Jean-Paul Sartre" },
      { title: "A Room of One's Own", author: "Virginia Woolf" },
      { title: "The Counterfeiters", author: "André Gide" },
      { title: "The Lover", author: "Marguerite Duras" },
      { title: "Les Enfants Terribles", author: "Jean Cocteau" },
      { title: "Beloved", author: "Toni Morrison" },
      { title: "Catch-22", author: "Joseph Heller" },
      { title: "The Catcher in the Rye", author: "J.D. Salinger" },
      { title: "To Kill a Mockingbird", author: "Harper Lee" },
      { title: "Invisible Man", author: "Ralph Ellison" },
      { title: "On the Road", author: "Jack Kerouac" },
      { title: "Ficciones", author: "Jorge Luis Borges" },
      { title: "The Unbearable Lightness of Being", author: "Milan Kundera" },
      { title: "The Metamorphosis", author: "Franz Kafka" },
      { title: "To the Lighthouse", author: "Virginia Woolf" },
      { title: "Mrs Dalloway", author: "Virginia Woolf" },
      { title: "The Bell Jar", author: "Sylvia Plath" },
      { title: "Steppenwolf", author: "Hermann Hesse" },
      { title: "Siddhartha", author: "Hermann Hesse" },
      { title: "The Glass Bead Game", author: "Hermann Hesse" },
      { title: "Things Fall Apart", author: "Chinua Achebe" },
      { title: "Animal Farm", author: "George Orwell" },
      { title: "A Farewell to Arms", author: "Ernest Hemingway" },
      { title: "Death in Venice", author: "Thomas Mann" },
      { title: "The Magic Mountain", author: "Thomas Mann" },
      { title: "Buddenbrooks", author: "Thomas Mann" },
      { title: "All Quiet on the Western Front", author: "Erich Maria Remarque" },
      { title: "Berlin Alexanderplatz", author: "Alfred Döblin" },
      { title: "Nadja", author: "André Breton" },
      { title: "The Tartar Steppe", author: "Dino Buzzati" },
      { title: "The Stranger", author: "Albert Camus" },
      { title: "The Myth of Sisyphus", author: "Albert Camus" },
      { title: "No Exit", author: "Jean-Paul Sartre" },
      { title: "The Mandarins", author: "Simone de Beauvoir" },
      { title: "Memoirs of Hadrian", author: "Marguerite Yourcenar" },
      { title: "Zazie in the Metro", author: "Raymond Queneau" },
      { title: "The Ravishing of Lol Stein", author: "Marguerite Duras" },
      { title: "Tropism", author: "Nathalie Sarraute" },
      { title: "A Void", author: "Georges Perec" },
      { title: "Life: A User's Manual", author: "Georges Perec" },
      { title: "W, or the Memory of Childhood", author: "Georges Perec" },
      { title: "The Opposing Shore", author: "Julien Gracq" },
      { title: "Friday", author: "Michel Tournier" },
      { title: "Bonjour Tristesse", author: "Françoise Sagan" },
      { title: "Thérèse Desqueyroux", author: "François Mauriac" },
      { title: "The Horseman on the Roof", author: "Jean Giono" },
      { title: "Strait Is the Gate", author: "André Gide" },
      { title: "The Immoralist", author: "André Gide" },
      { title: "The Voyeur", author: "Alain Robbe-Grillet" },
      { title: "Jealousy", author: "Alain Robbe-Grillet" },
      { title: "The Erasers", author: "Alain Robbe-Grillet" },
      { title: "Moderato Cantabile", author: "Marguerite Duras" },
      { title: "The Wind", author: "Claude Simon" },
      { title: "The Flanders Road", author: "Claude Simon" },
      { title: "The Bald Soprano", author: "Eugène Ionesco" },
      { title: "Rhinoceros", author: "Eugène Ionesco" },
      { title: "Endgame", author: "Samuel Beckett" },
      { title: "Molloy", author: "Samuel Beckett" },
      { title: "The Unnamable", author: "Samuel Beckett" },
      { title: "The Roots of Heaven", author: "Romain Gary" },
      { title: "Promise at Dawn", author: "Romain Gary" },
      { title: "The Life Before Us", author: "Romain Gary" },
      { title: "Gargantua and Pantagruel", author: "François Rabelais" },
      { title: "Germinal", author: "Émile Zola" },
      { title: "Les Misérables", author: "Victor Hugo" },
      { title: "Madame Bovary", author: "Gustave Flaubert" },
      { title: "The Red and the Black", author: "Stendhal" },
      { title: "The Count of Monte Cristo", author: "Alexandre Dumas" },
      { title: "Cyrano de Bergerac", author: "Edmond Rostand" },
    ]
  },
  modernlibrary: {
    title: "Modern Library 100 Best Novels",
    source: "Modern Library",
    year: "1998",
    desc: "The board's selection of the 100 best English-language novels published since 1900. A canonical list that has sparked endless debate since its publication.",
    books: [
      { title: "Ulysses", author: "James Joyce" },
      { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
      { title: "A Portrait of the Artist as a Young Man", author: "James Joyce" },
      { title: "Lolita", author: "Vladimir Nabokov" },
      { title: "Brave New World", author: "Aldous Huxley" },
      { title: "The Sound and the Fury", author: "William Faulkner" },
      { title: "Catch-22", author: "Joseph Heller" },
      { title: "Darkness at Noon", author: "Arthur Koestler" },
      { title: "Sons and Lovers", author: "D.H. Lawrence" },
      { title: "The Grapes of Wrath", author: "John Steinbeck" },
      { title: "Under the Volcano", author: "Malcolm Lowry" },
      { title: "The Way of All Flesh", author: "Samuel Butler" },
      { title: "1984", author: "George Orwell" },
      { title: "I, Claudius", author: "Robert Graves" },
      { title: "To the Lighthouse", author: "Virginia Woolf" },
      { title: "An American Tragedy", author: "Theodore Dreiser" },
      { title: "The Heart Is a Lonely Hunter", author: "Carson McCullers" },
      { title: "Slaughterhouse-Five", author: "Kurt Vonnegut" },
      { title: "Invisible Man", author: "Ralph Ellison" },
      { title: "Native Son", author: "Richard Wright" },
      { title: "Henderson the Rain King", author: "Saul Bellow" },
      { title: "Appointment in Samarra", author: "John O'Hara" },
      { title: "U.S.A. Trilogy", author: "John Dos Passos" },
      { title: "Winesburg, Ohio", author: "Sherwood Anderson" },
      { title: "A Passage to India", author: "E.M. Forster" },
      { title: "The Wings of the Dove", author: "Henry James" },
      { title: "The Ambassadors", author: "Henry James" },
      { title: "Tender Is the Night", author: "F. Scott Fitzgerald" },
      { title: "The Studs Lonigan Trilogy", author: "James T. Farrell" },
      { title: "The Good Soldier", author: "Ford Madox Ford" },
      { title: "Animal Farm", author: "George Orwell" },
      { title: "The Golden Bowl", author: "Henry James" },
      { title: "Sister Carrie", author: "Theodore Dreiser" },
      { title: "A Handful of Dust", author: "Evelyn Waugh" },
      { title: "As I Lay Dying", author: "William Faulkner" },
      { title: "All the King's Men", author: "Robert Penn Warren" },
      { title: "The Bridge of San Luis Rey", author: "Thornton Wilder" },
      { title: "Howards End", author: "E.M. Forster" },
      { title: "Go Tell It on the Mountain", author: "James Baldwin" },
      { title: "The Heart of the Matter", author: "Graham Greene" },
      { title: "Lord of the Flies", author: "William Golding" },
      { title: "Deliverance", author: "James Dickey" },
      { title: "A Dance to the Music of Time", author: "Anthony Powell" },
      { title: "Point Counter Point", author: "Aldous Huxley" },
      { title: "The Sun Also Rises", author: "Ernest Hemingway" },
      { title: "The Secret Agent", author: "Joseph Conrad" },
      { title: "Nostromo", author: "Joseph Conrad" },
      { title: "The Rainbow", author: "D.H. Lawrence" },
      { title: "Women in Love", author: "D.H. Lawrence" },
      { title: "Tropic of Cancer", author: "Henry Miller" },
      { title: "The Naked and the Dead", author: "Norman Mailer" },
      { title: "Portnoy's Complaint", author: "Philip Roth" },
      { title: "Pale Fire", author: "Vladimir Nabokov" },
      { title: "Light in August", author: "William Faulkner" },
      { title: "On the Road", author: "Jack Kerouac" },
      { title: "The Maltese Falcon", author: "Dashiell Hammett" },
      { title: "Parade's End", author: "Ford Madox Ford" },
      { title: "The Age of Innocence", author: "Edith Wharton" },
      { title: "Zuleika Dobson", author: "Max Beerbohm" },
      { title: "The Moviegoer", author: "Walker Percy" },
      { title: "Death Comes for the Archbishop", author: "Willa Cather" },
      { title: "From Here to Eternity", author: "James Jones" },
      { title: "The Wapshot Chronicles", author: "John Cheever" },
      { title: "The Catcher in the Rye", author: "J.D. Salinger" },
      { title: "A Clockwork Orange", author: "Anthony Burgess" },
      { title: "Of Human Bondage", author: "W. Somerset Maugham" },
      { title: "Heart of Darkness", author: "Joseph Conrad" },
      { title: "Main Street", author: "Sinclair Lewis" },
      { title: "The House of Mirth", author: "Edith Wharton" },
      { title: "The Alexandria Quartet", author: "Lawrence Durrell" },
      { title: "A High Wind in Jamaica", author: "Richard Hughes" },
      { title: "A House for Mr Biswas", author: "V.S. Naipaul" },
      { title: "The Day of the Locust", author: "Nathanael West" },
      { title: "A Farewell to Arms", author: "Ernest Hemingway" },
      { title: "Scoop", author: "Evelyn Waugh" },
      { title: "The Prime of Miss Jean Brodie", author: "Muriel Spark" },
      { title: "Finnegans Wake", author: "James Joyce" },
      { title: "Kim", author: "Rudyard Kipling" },
      { title: "A Room with a View", author: "E.M. Forster" },
      { title: "Brideshead Revisited", author: "Evelyn Waugh" },
      { title: "The Adventures of Augie March", author: "Saul Bellow" },
      { title: "Angle of Repose", author: "Wallace Stegner" },
      { title: "A Bend in the River", author: "V.S. Naipaul" },
      { title: "The Death of the Heart", author: "Elizabeth Bowen" },
      { title: "Lord Jim", author: "Joseph Conrad" },
      { title: "Ragtime", author: "E.L. Doctorow" },
      { title: "The Old Wives' Tale", author: "Arnold Bennett" },
      { title: "The Call of the Wild", author: "Jack London" },
      { title: "Loving", author: "Henry Green" },
      { title: "Midnight's Children", author: "Salman Rushdie" },
      { title: "Tobacco Road", author: "Erskine Caldwell" },
      { title: "Ironweed", author: "William Kennedy" },
      { title: "The Magus", author: "John Fowles" },
      { title: "Wide Sargasso Sea", author: "Jean Rhys" },
      { title: "Under the Net", author: "Iris Murdoch" },
      { title: "Sophie's Choice", author: "William Styron" },
      { title: "The Sheltering Sky", author: "Paul Bowles" },
      { title: "The Postman Always Rings Twice", author: "James M. Cain" },
      { title: "The Ginger Man", author: "J.P. Donleavy" },
      { title: "The Magnificent Ambersons", author: "Booth Tarkington" },
    ]
  },
  telegraph: {
    title: "The Telegraph's Greatest Villains in Literature",
    source: "The Telegraph",
    year: "2008",
    desc: "The most compelling, chilling and unforgettable antagonists ever committed to the page — the books that gave us literature's greatest monsters.",
    books: [
      { title: "Lolita", author: "Vladimir Nabokov" },
      { title: "Crime and Punishment", author: "Fyodor Dostoevsky" },
      { title: "American Psycho", author: "Bret Easton Ellis" },
      { title: "We Need to Talk About Kevin", author: "Lionel Shriver" },
      { title: "Perfume", author: "Patrick Süskind" },
      { title: "The Talented Mr Ripley", author: "Patricia Highsmith" },
      { title: "Rebecca", author: "Daphne du Maurier" },
      { title: "No Country for Old Men", author: "Cormac McCarthy" },
      { title: "The Silence of the Lambs", author: "Thomas Harris" },
      { title: "Frankenstein", author: "Mary Shelley" },
      { title: "Blood Meridian", author: "Cormac McCarthy" },
      { title: "The Picture of Dorian Gray", author: "Oscar Wilde" },
      { title: "Dracula", author: "Bram Stoker" },
      { title: "Gone Girl", author: "Gillian Flynn" },
      { title: "Nineteen Eighty-Four", author: "George Orwell" },
      { title: "A Clockwork Orange", author: "Anthony Burgess" },
      { title: "The Shining", author: "Stephen King" },
      { title: "Lord of the Flies", author: "William Golding" },
      { title: "Misery", author: "Stephen King" },
      { title: "Battle Royale", author: "Koushun Takami" },
      { title: "Wuthering Heights", author: "Emily Brontë" },
      { title: "Othello", author: "William Shakespeare" },
      { title: "Paradise Lost", author: "John Milton" },
      { title: "The Count of Monte Cristo", author: "Alexandre Dumas" },
      { title: "Great Expectations", author: "Charles Dickens" },
      { title: "Oliver Twist", author: "Charles Dickens" },
      { title: "The Strange Case of Dr Jekyll and Mr Hyde", author: "Robert Louis Stevenson" },
      { title: "Moby-Dick", author: "Herman Melville" },
      { title: "The Phantom of the Opera", author: "Gaston Leroux" },
      { title: "The Hound of the Baskervilles", author: "Arthur Conan Doyle" },
      { title: "Heart of Darkness", author: "Joseph Conrad" },
      { title: "The Turn of the Screw", author: "Henry James" },
      { title: "One Flew Over the Cuckoo's Nest", author: "Ken Kesey" },
      { title: "The Collector", author: "John Fowles" },
      { title: "Rosemary's Baby", author: "Ira Levin" },
      { title: "The Exorcist", author: "William Peter Blatty" },
      { title: "The Omen", author: "David Seltzer" },
      { title: "Carrie", author: "Stephen King" },
      { title: "It", author: "Stephen King" },
      { title: "Pet Sematary", author: "Stephen King" },
      { title: "The Stand", author: "Stephen King" },
      { title: "Hannibal", author: "Thomas Harris" },
      { title: "Red Dragon", author: "Thomas Harris" },
      { title: "The Girl with the Dragon Tattoo", author: "Stieg Larsson" },
      { title: "Sharp Objects", author: "Gillian Flynn" },
      { title: "The Secret History", author: "Donna Tartt" },
      { title: "And Then There Were None", author: "Agatha Christie" },
      { title: "The Murder of Roger Ackroyd", author: "Agatha Christie" },
      { title: "In Cold Blood", author: "Truman Capote" },
      { title: "The Talented Mr. Ripley", author: "Patricia Highsmith" },
      { title: "A Good Man Is Hard to Find", author: "Flannery O'Connor" },
      { title: "The Wasp Factory", author: "Iain Banks" },
      { title: "Atonement", author: "Ian McEwan" },
      { title: "Enduring Love", author: "Ian McEwan" },
      { title: "The Comfort of Strangers", author: "Ian McEwan" },
      { title: "The Haunting of Hill House", author: "Shirley Jackson" },
      { title: "We Have Always Lived in the Castle", author: "Shirley Jackson" },
      { title: "Something Wicked This Way Comes", author: "Ray Bradbury" },
      { title: "The Island of Doctor Moreau", author: "H.G. Wells" },
      { title: "The Invisible Man", author: "H.G. Wells" },
      { title: "The War of the Worlds", author: "H.G. Wells" },
      { title: "Do Androids Dream of Electric Sheep?", author: "Philip K. Dick" },
      { title: "The Stepford Wives", author: "Ira Levin" },
      { title: "The Boys from Brazil", author: "Ira Levin" },
      { title: "Psycho", author: "Robert Bloch" },
      { title: "The Phantom of the Opera", author: "Gaston Leroux" },
      { title: "The Monk", author: "Matthew Lewis" },
      { title: "The Castle of Otranto", author: "Horace Walpole" },
      { title: "The Mysteries of Udolpho", author: "Ann Radcliffe" },
      { title: "Northanger Abbey", author: "Jane Austen" },
      { title: "Jane Eyre", author: "Charlotte Brontë" },
      { title: "Villette", author: "Charlotte Brontë" },
      { title: "The Woman in White", author: "Wilkie Collins" },
      { title: "The Moonstone", author: "Wilkie Collins" },
      { title: "Bleak House", author: "Charles Dickens" },
      { title: "A Tale of Two Cities", author: "Charles Dickens" },
      { title: "The Hunchback of Notre-Dame", author: "Victor Hugo" },
      { title: "Les Misérables", author: "Victor Hugo" },
      { title: "The Brothers Karamazov", author: "Fyodor Dostoevsky" },
      { title: "Notes from Underground", author: "Fyodor Dostoevsky" },
      { title: "Dead Souls", author: "Nikolai Gogol" },
      { title: "Anna Karenina", author: "Leo Tolstoy" },
      { title: "War and Peace", author: "Leo Tolstoy" },
      { title: "The Master and Margarita", author: "Mikhail Bulgakov" },
      { title: "Child of God", author: "Cormac McCarthy" },
      { title: "Outer Dark", author: "Cormac McCarthy" },
      { title: "The Road", author: "Cormac McCarthy" },
      { title: "Under the Skin", author: "Michel Faber" },
      { title: "The Dice Man", author: "Luke Rhinehart" },
      { title: "Filth", author: "Irvine Welsh" },
      { title: "Trainspotting", author: "Irvine Welsh" },
      { title: "The Killer Inside Me", author: "Jim Thompson" },
      { title: "The Getaway", author: "Jim Thompson" },
      { title: "Clockers", author: "Richard Price" },
      { title: "The Devil All the Time", author: "Donald Ray Pollock" },
      { title: "Tampa", author: "Alissa Nutting" },
      { title: "You", author: "Caroline Kepnes" },
      { title: "My Year of Rest and Relaxation", author: "Ottessa Moshfegh" },
      { title: "Apt Pupil", author: "Stephen King" },
    ]
  },
  bbc: {
    title: "BBC's 100 Novels That Shaped Our World",
    source: "BBC",
    year: "2019",
    desc: "A celebration of fiction that has had a profound impact on culture, society and our understanding of what it means to be human.",
    books: [
      { title: "Frankenstein", author: "Mary Shelley" },
      { title: "Jane Eyre", author: "Charlotte Brontë" },
      { title: "Middlemarch", author: "George Eliot" },
      { title: "The War of the Worlds", author: "H.G. Wells" },
      { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
      { title: "Mrs Dalloway", author: "Virginia Woolf" },
      { title: "Brave New World", author: "Aldous Huxley" },
      { title: "Their Eyes Were Watching God", author: "Zora Neale Hurston" },
      { title: "The Second Sex", author: "Simone de Beauvoir" },
      { title: "Nineteen Eighty-Four", author: "George Orwell" },
      { title: "The Catcher in the Rye", author: "J.D. Salinger" },
      { title: "Lord of the Flies", author: "William Golding" },
      { title: "Lolita", author: "Vladimir Nabokov" },
      { title: "To Kill a Mockingbird", author: "Harper Lee" },
      { title: "One Hundred Years of Solitude", author: "Gabriel García Márquez" },
      { title: "The Female Eunuch", author: "Germaine Greer" },
      { title: "Watership Down", author: "Richard Adams" },
      { title: "The Hitchhiker's Guide to the Galaxy", author: "Douglas Adams" },
      { title: "If on a winter's night a traveler", author: "Italo Calvino" },
      { title: "The Color Purple", author: "Alice Walker" },
      { title: "Beloved", author: "Toni Morrison" },
      { title: "A Room of One's Own", author: "Virginia Woolf" },
      { title: "Things Fall Apart", author: "Chinua Achebe" },
      { title: "A Clockwork Orange", author: "Anthony Burgess" },
      { title: "Wide Sargasso Sea", author: "Jean Rhys" },
      { title: "Midnight's Children", author: "Salman Rushdie" },
      { title: "The Handmaid's Tale", author: "Margaret Atwood" },
      { title: "The Remains of the Day", author: "Kazuo Ishiguro" },
      { title: "Harry Potter and the Philosopher's Stone", author: "J.K. Rowling" },
      { title: "The Curious Incident of the Dog in the Night-Time", author: "Mark Haddon" },
      { title: "Ulysses", author: "James Joyce" },
      { title: "In Search of Lost Time", author: "Marcel Proust" },
      { title: "The Trial", author: "Franz Kafka" },
      { title: "The Master and Margarita", author: "Mikhail Bulgakov" },
      { title: "Invisible Man", author: "Ralph Ellison" },
      { title: "On the Road", author: "Jack Kerouac" },
      { title: "Catch-22", author: "Joseph Heller" },
      { title: "One Flew Over the Cuckoo's Nest", author: "Ken Kesey" },
      { title: "Slaughterhouse-Five", author: "Kurt Vonnegut" },
      { title: "Song of Solomon", author: "Toni Morrison" },
      { title: "Dracula", author: "Bram Stoker" },
      { title: "Rebecca", author: "Daphne du Maurier" },
      { title: "The Big Sleep", author: "Raymond Chandler" },
      { title: "The Maltese Falcon", author: "Dashiell Hammett" },
      { title: "And Then There Were None", author: "Agatha Christie" },
      { title: "The Spy Who Came in from the Cold", author: "John le Carré" },
      { title: "The Godfather", author: "Mario Puzo" },
      { title: "Gone Girl", author: "Gillian Flynn" },
      { title: "The Girl with the Dragon Tattoo", author: "Stieg Larsson" },
      { title: "Bridget Jones's Diary", author: "Helen Fielding" },
      { title: "Pride and Prejudice", author: "Jane Austen" },
      { title: "Wuthering Heights", author: "Emily Brontë" },
      { title: "Anna Karenina", author: "Leo Tolstoy" },
      { title: "Gone with the Wind", author: "Margaret Mitchell" },
      { title: "The Thorn Birds", author: "Colleen McCullough" },
      { title: "Atonement", author: "Ian McEwan" },
      { title: "Normal People", author: "Sally Rooney" },
      { title: "A Suitable Boy", author: "Vikram Seth" },
      { title: "Persepolis", author: "Marjane Satrapi" },
      { title: "A Brief History of Seven Killings", author: "Marlon James" },
      { title: "The Lord of the Rings", author: "J.R.R. Tolkien" },
      { title: "The Lion, the Witch and the Wardrobe", author: "C.S. Lewis" },
      { title: "Earthsea", author: "Ursula K. Le Guin" },
      { title: "Jonathan Strange & Mr Norrell", author: "Susanna Clarke" },
      { title: "The Hobbit", author: "J.R.R. Tolkien" },
      { title: "His Dark Materials", author: "Philip Pullman" },
      { title: "A Game of Thrones", author: "George R.R. Martin" },
      { title: "Neuromancer", author: "William Gibson" },
      { title: "Do Androids Dream of Electric Sheep?", author: "Philip K. Dick" },
      { title: "The Left Hand of Darkness", author: "Ursula K. Le Guin" },
      { title: "Dune", author: "Frank Herbert" },
      { title: "The Day of the Triffids", author: "John Wyndham" },
      { title: "2001: A Space Odyssey", author: "Arthur C. Clarke" },
      { title: "I, Robot", author: "Isaac Asimov" },
      { title: "Foundation", author: "Isaac Asimov" },
      { title: "Kindred", author: "Octavia E. Butler" },
      { title: "The Jungle Book", author: "Rudyard Kipling" },
      { title: "Winnie-the-Pooh", author: "A.A. Milne" },
      { title: "Alice's Adventures in Wonderland", author: "Lewis Carroll" },
      { title: "Charlie and the Chocolate Factory", author: "Roald Dahl" },
      { title: "Noughts & Crosses", author: "Malorie Blackman" },
      { title: "The Diary of a Young Girl", author: "Anne Frank" },
      { title: "Pippi Longstocking", author: "Astrid Lindgren" },
      { title: "Northern Lights", author: "Philip Pullman" },
      { title: "Little Women", author: "Louisa May Alcott" },
      { title: "Charlotte's Web", author: "E.B. White" },
      { title: "The Wind in the Willows", author: "Kenneth Grahame" },
      { title: "Treasure Island", author: "Robert Louis Stevenson" },
      { title: "Black Beauty", author: "Anna Sewell" },
      { title: "The Secret Garden", author: "Frances Hodgson Burnett" },
      { title: "A Little Princess", author: "Frances Hodgson Burnett" },
      { title: "The Railway Children", author: "E. Nesbit" },
      { title: "Swallows and Amazons", author: "Arthur Ransome" },
      { title: "Ballet Shoes", author: "Noel Streatfeild" },
      { title: "The Borrowers", author: "Mary Norton" },
      { title: "The Phantom Tollbooth", author: "Norton Juster" },
      { title: "The Outsiders", author: "S.E. Hinton" },
      { title: "Roll of Thunder, Hear My Cry", author: "Mildred D. Taylor" },
      { title: "Wolf Hall", author: "Hilary Mantel" },
      { title: "White Teeth", author: "Zadie Smith" },
    ]
  },
  time: {
    title: "TIME's 100 Best Novels",
    source: "TIME Magazine",
    year: "2005",
    desc: "TIME critics Lev Grossman and Richard Lacayo's picks for the 100 best English-language novels from 1923 to the present.",
    books: [
      { title: "Beloved", author: "Toni Morrison" },
      { title: "The Complete Stories", author: "Flannery O'Connor" },
      { title: "The Corrections", author: "Jonathan Franzen" },
      { title: "The Stories of John Cheever", author: "John Cheever" },
      { title: "At Swim-Two-Birds", author: "Flann O'Brien" },
      { title: "Atonement", author: "Ian McEwan" },
      { title: "Blood Meridian", author: "Cormac McCarthy" },
      { title: "Catch-22", author: "Joseph Heller" },
      { title: "A Clockwork Orange", author: "Anthony Burgess" },
      { title: "The Crying of Lot 49", author: "Thomas Pynchon" },
      { title: "Slaughterhouse-Five", author: "Kurt Vonnegut" },
      { title: "To Kill a Mockingbird", author: "Harper Lee" },
      { title: "White Noise", author: "Don DeLillo" },
      { title: "The Lord of the Rings", author: "J.R.R. Tolkien" },
      { title: "Never Let Me Go", author: "Kazuo Ishiguro" },
      { title: "Lolita", author: "Vladimir Nabokov" },
      { title: "The Remains of the Day", author: "Kazuo Ishiguro" },
      { title: "American Pastoral", author: "Philip Roth" },
      { title: "Midnight's Children", author: "Salman Rushdie" },
      { title: "The Road", author: "Cormac McCarthy" },
      { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
      { title: "A Handful of Dust", author: "Evelyn Waugh" },
      { title: "A House for Mr Biswas", author: "V.S. Naipaul" },
      { title: "In Search of Lost Time", author: "Marcel Proust" },
      { title: "Invisible Man", author: "Ralph Ellison" },
      { title: "Light in August", author: "William Faulkner" },
      { title: "The Lion, the Witch and the Wardrobe", author: "C.S. Lewis" },
      { title: "Money", author: "Martin Amis" },
      { title: "The Moviegoer", author: "Walker Percy" },
      { title: "Mrs Dalloway", author: "Virginia Woolf" },
      { title: "Naked Lunch", author: "William S. Burroughs" },
      { title: "Native Son", author: "Richard Wright" },
      { title: "Neuromancer", author: "William Gibson" },
      { title: "On the Road", author: "Jack Kerouac" },
      { title: "One Flew Over the Cuckoo's Nest", author: "Ken Kesey" },
      { title: "The Painted Bird", author: "Jerzy Kosiński" },
      { title: "Pale Fire", author: "Vladimir Nabokov" },
      { title: "A Passage to India", author: "E.M. Forster" },
      { title: "Play It as It Lays", author: "Joan Didion" },
      { title: "Portnoy's Complaint", author: "Philip Roth" },
      { title: "Possession", author: "A.S. Byatt" },
      { title: "The Power and the Glory", author: "Graham Greene" },
      { title: "The Prime of Miss Jean Brodie", author: "Muriel Spark" },
      { title: "Rabbit, Run", author: "John Updike" },
      { title: "Ragtime", author: "E.L. Doctorow" },
      { title: "The Recognitions", author: "William Gaddis" },
      { title: "Revolutionary Road", author: "Richard Yates" },
      { title: "The Sheltering Sky", author: "Paul Bowles" },
      { title: "Snow Crash", author: "Neal Stephenson" },
      { title: "The Sot-Weed Factor", author: "John Barth" },
      { title: "The Sound and the Fury", author: "William Faulkner" },
      { title: "The Spy Who Came in from the Cold", author: "John le Carré" },
      { title: "The Sun Also Rises", author: "Ernest Hemingway" },
      { title: "Their Eyes Were Watching God", author: "Zora Neale Hurston" },
      { title: "Things Fall Apart", author: "Chinua Achebe" },
      { title: "To the Lighthouse", author: "Virginia Woolf" },
      { title: "Tropic of Cancer", author: "Henry Miller" },
      { title: "Ubik", author: "Philip K. Dick" },
      { title: "Under the Net", author: "Iris Murdoch" },
      { title: "Under the Volcano", author: "Malcolm Lowry" },
      { title: "Watchmen", author: "Alan Moore" },
      { title: "White Teeth", author: "Zadie Smith" },
      { title: "Wide Sargasso Sea", author: "Jean Rhys" },
      { title: "Winesburg, Ohio", author: "Sherwood Anderson" },
      { title: "The Wings of the Dove", author: "Henry James" },
      { title: "Women in Love", author: "D.H. Lawrence" },
      { title: "An American Tragedy", author: "Theodore Dreiser" },
      { title: "Animal Farm", author: "George Orwell" },
      { title: "Are You There God? It's Me, Margaret", author: "Judy Blume" },
      { title: "Brideshead Revisited", author: "Evelyn Waugh" },
      { title: "The Bridge of San Luis Rey", author: "Thornton Wilder" },
      { title: "Call It Sleep", author: "Henry Roth" },
      { title: "A Death in the Family", author: "James Agee" },
      { title: "The Death of the Heart", author: "Elizabeth Bowen" },
      { title: "Deliverance", author: "James Dickey" },
      { title: "Dog Soldiers", author: "Robert Stone" },
      { title: "Falconer", author: "John Cheever" },
      { title: "The French Lieutenant's Woman", author: "John Fowles" },
      { title: "The Golden Notebook", author: "Doris Lessing" },
      { title: "Go Tell It on the Mountain", author: "James Baldwin" },
      { title: "Gone with the Wind", author: "Margaret Mitchell" },
      { title: "Gravity's Rainbow", author: "Thomas Pynchon" },
      { title: "The Grapes of Wrath", author: "John Steinbeck" },
      { title: "The Heart Is a Lonely Hunter", author: "Carson McCullers" },
      { title: "The Heart of the Matter", author: "Graham Greene" },
      { title: "Herzog", author: "Saul Bellow" },
      { title: "Housekeeping", author: "Marilynne Robinson" },
      { title: "I, Claudius", author: "Robert Graves" },
      { title: "Infinite Jest", author: "David Foster Wallace" },
      { title: "The Jungle", author: "Upton Sinclair" },
      { title: "1984", author: "George Orwell" },
      { title: "Brave New World", author: "Aldous Huxley" },
      { title: "Darkness at Noon", author: "Arthur Koestler" },
      { title: "The Day of the Locust", author: "Nathanael West" },
      { title: "Lord of the Flies", author: "William Golding" },
      { title: "Lucky Jim", author: "Kingsley Amis" },
      { title: "The Man Who Loved Children", author: "Christina Stead" },
      { title: "Loving", author: "Henry Green" },
      { title: "Ulysses", author: "James Joyce" },
      { title: "U.S.A. Trilogy", author: "John Dos Passos" },
    ]
  },
  guardian: {
    title: "The Guardian's 100 Best Novels",
    source: "The Guardian",
    year: "2015",
    desc: "Robert McCrum's selection of the finest novels written in English, from Robinson Crusoe to American Pastoral. A journey through 300 years of the English-language novel.",
    books: [
      { title: "The Pilgrim's Progress", author: "John Bunyan" },
      { title: "Robinson Crusoe", author: "Daniel Defoe" },
      { title: "Gulliver's Travels", author: "Jonathan Swift" },
      { title: "Clarissa", author: "Samuel Richardson" },
      { title: "Tom Jones", author: "Henry Fielding" },
      { title: "The Life and Opinions of Tristram Shandy", author: "Laurence Sterne" },
      { title: "Emma", author: "Jane Austen" },
      { title: "Frankenstein", author: "Mary Shelley" },
      { title: "The Narrative of Arthur Gordon Pym", author: "Edgar Allan Poe" },
      { title: "Vanity Fair", author: "William Makepeace Thackeray" },
      { title: "Jane Eyre", author: "Charlotte Brontë" },
      { title: "David Copperfield", author: "Charles Dickens" },
      { title: "Moby-Dick", author: "Herman Melville" },
      { title: "Middlemarch", author: "George Eliot" },
      { title: "The Adventures of Huckleberry Finn", author: "Mark Twain" },
      { title: "The Picture of Dorian Gray", author: "Oscar Wilde" },
      { title: "The Sign of Four", author: "Arthur Conan Doyle" },
      { title: "Jude the Obscure", author: "Thomas Hardy" },
      { title: "The Turn of the Screw", author: "Henry James" },
      { title: "Heart of Darkness", author: "Joseph Conrad" },
      { title: "Wuthering Heights", author: "Emily Brontë" },
      { title: "The Scarlet Letter", author: "Nathaniel Hawthorne" },
      { title: "Alice's Adventures in Wonderland", author: "Lewis Carroll" },
      { title: "Little Women", author: "Louisa May Alcott" },
      { title: "The Way We Live Now", author: "Anthony Trollope" },
      { title: "The Woman in White", author: "Wilkie Collins" },
      { title: "Great Expectations", author: "Charles Dickens" },
      { title: "Silas Marner", author: "George Eliot" },
      { title: "Bleak House", author: "Charles Dickens" },
      { title: "Treasure Island", author: "Robert Louis Stevenson" },
      { title: "Kim", author: "Rudyard Kipling" },
      { title: "The Wonderful Wizard of Oz", author: "L. Frank Baum" },
      { title: "The Hound of the Baskervilles", author: "Arthur Conan Doyle" },
      { title: "The Call of the Wild", author: "Jack London" },
      { title: "The Golden Bowl", author: "Henry James" },
      { title: "The Wind in the Willows", author: "Kenneth Grahame" },
      { title: "The Secret Agent", author: "Joseph Conrad" },
      { title: "A Room with a View", author: "E.M. Forster" },
      { title: "The Secret Garden", author: "Frances Hodgson Burnett" },
      { title: "Sons and Lovers", author: "D.H. Lawrence" },
      { title: "The Good Soldier", author: "Ford Madox Ford" },
      { title: "The Thirty-Nine Steps", author: "John Buchan" },
      { title: "The Age of Innocence", author: "Edith Wharton" },
      { title: "Ulysses", author: "James Joyce" },
      { title: "A Passage to India", author: "E.M. Forster" },
      { title: "The Great Gatsby", author: "F. Scott Fitzgerald" },
      { title: "Mrs Dalloway", author: "Virginia Woolf" },
      { title: "The Sun Also Rises", author: "Ernest Hemingway" },
      { title: "To the Lighthouse", author: "Virginia Woolf" },
      { title: "Orlando", author: "Virginia Woolf" },
      { title: "As I Lay Dying", author: "William Faulkner" },
      { title: "Brave New World", author: "Aldous Huxley" },
      { title: "Cold Comfort Farm", author: "Stella Gibbons" },
      { title: "Scoop", author: "Evelyn Waugh" },
      { title: "The Big Sleep", author: "Raymond Chandler" },
      { title: "Party Going", author: "Henry Green" },
      { title: "At Swim-Two-Birds", author: "Flann O'Brien" },
      { title: "The Grapes of Wrath", author: "John Steinbeck" },
      { title: "Joy in the Morning", author: "P.G. Wodehouse" },
      { title: "All the King's Men", author: "Robert Penn Warren" },
      { title: "Under the Volcano", author: "Malcolm Lowry" },
      { title: "Nineteen Eighty-Four", author: "George Orwell" },
      { title: "The End of the Affair", author: "Graham Greene" },
      { title: "The Catcher in the Rye", author: "J.D. Salinger" },
      { title: "The Adventures of Augie March", author: "Saul Bellow" },
      { title: "Lord of the Flies", author: "William Golding" },
      { title: "Lolita", author: "Vladimir Nabokov" },
      { title: "On the Road", author: "Jack Kerouac" },
      { title: "Voss", author: "Patrick White" },
      { title: "To Kill a Mockingbird", author: "Harper Lee" },
      { title: "The Prime of Miss Jean Brodie", author: "Muriel Spark" },
      { title: "Catch-22", author: "Joseph Heller" },
      { title: "A Clockwork Orange", author: "Anthony Burgess" },
      { title: "A Single Man", author: "Christopher Isherwood" },
      { title: "In Cold Blood", author: "Truman Capote" },
      { title: "The Bell Jar", author: "Sylvia Plath" },
      { title: "Portnoy's Complaint", author: "Philip Roth" },
      { title: "Mrs Palfrey at the Claremont", author: "Elizabeth Taylor" },
      { title: "Rabbit Redux", author: "John Updike" },
      { title: "Song of Solomon", author: "Toni Morrison" },
      { title: "A Bend in the River", author: "V.S. Naipaul" },
      { title: "Midnight's Children", author: "Salman Rushdie" },
      { title: "Housekeeping", author: "Marilynne Robinson" },
      { title: "Money", author: "Martin Amis" },
      { title: "An Artist of the Floating World", author: "Kazuo Ishiguro" },
      { title: "The Beginning of Spring", author: "Penelope Fitzgerald" },
      { title: "Possession", author: "A.S. Byatt" },
      { title: "Amongst Women", author: "John McGahern" },
      { title: "Underworld", author: "Don DeLillo" },
      { title: "Disgrace", author: "J.M. Coetzee" },
      { title: "True History of the Kelly Gang", author: "Peter Carey" },
      { title: "The Corrections", author: "Jonathan Franzen" },
      { title: "Atonement", author: "Ian McEwan" },
      { title: "Fingersmith", author: "Sarah Waters" },
      { title: "The Known World", author: "Edward P. Jones" },
      { title: "Small Island", author: "Andrea Levy" },
      { title: "Never Let Me Go", author: "Kazuo Ishiguro" },
      { title: "The Brief Wondrous Life of Oscar Wao", author: "Junot Díaz" },
      { title: "Wolf Hall", author: "Hilary Mantel" },
      { title: "American Pastoral", author: "Philip Roth" },
    ]
  }
};

// ─── GOOGLE BOOKS API ────────────────────────────────────────────────────
// Uses Google Books for search & covers — no API key needed for basic use,
// falls back to Open Library covers when Google has none.
const OL = 'https://openlibrary.org';

async function searchBooks(query, limit = 20) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${Math.min(limit,40)}&printType=books&langRestrict=en`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.items || []).map(normalizeGoogleBook);
}

async function searchBooksForList(title, author) {
  const q = `intitle:${title} inauthor:${author}`;
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1&printType=books`;
  const res = await fetch(url);
  const data = await res.json();
  const book = data.items?.[0] ? normalizeGoogleBook(data.items[0]) : { key: title, title, author, coverUrl: null, year: '', pages: null, description: '' };
  if (!book.coverUrl) {
    book.coverUrl = await getWikipediaCover(title, author);
  }
  return book;
}

async function fetchBookDetails(key) {
  // key is either a Google Books volume id or an OL works key
  if (key.startsWith('/works/')) {
    const res = await fetch(`${OL}${key}.json`);
    return await res.json();
  }
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes/${key}`);
  return await res.json();
}

async function getPopularBooks(subject, limit = 16) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=subject:${encodeURIComponent(subject)}&maxResults=${Math.min(limit,40)}&orderBy=relevance&printType=books&langRestrict=en`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.items || []).map(normalizeGoogleBook);
}

// Fetch a curated shelf — tries Google Books first, falls back to Wikipedia for cover
async function getCuratedShelf(titles) {
  const results = await Promise.allSettled(
    titles.map(async ({ title, author }) => {
      const q = `intitle:${title} inauthor:${author}`;
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1&printType=books`);
      const data = await res.json();
      const book = data.items?.[0] ? normalizeGoogleBook(data.items[0]) : { key: title, title, author, coverUrl: null, year: '', pages: null, description: '' };
      // If no cover from Google, try Wikipedia
      if (!book.coverUrl) {
        book.coverUrl = await getWikipediaCover(title, author);
      }
      return book.coverUrl ? book : null;
    })
  );
  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

function normalizeGoogleBook(item) {
  const info = item.volumeInfo || {};
  let coverUrl = null;
  if (info.imageLinks) {
    // Try to get the best available image, bump zoom for quality
    const base = (info.imageLinks.extraLarge || info.imageLinks.large ||
                  info.imageLinks.medium || info.imageLinks.thumbnail ||
                  info.imageLinks.smallThumbnail || '');
    coverUrl = base
      .replace('http://', 'https://')
      .replace('&edge=curl', '')
      .replace('zoom=1', 'zoom=2')
      .replace('zoom=1', 'zoom=2');
  }
  return {
    key: item.id,
    title: info.title || 'Unknown Title',
    author: info.authors?.[0] || 'Unknown Author',
    coverUrl: coverUrl,
    year: info.publishedDate?.substring(0, 4) || '',
    pages: info.pageCount || null,
    description: info.description || '',
    categories: info.categories || [],
  };
}

// Wikipedia cover fallback — fetches the book's main image from its Wikipedia article
async function getWikipediaCover(title, author) {
  try {
    const search = `${title} novel`;
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(search)}&prop=pageimages&format=json&pithumbsize=400&origin=*`;
    const res = await fetch(url);
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {});
    const img = pages[0]?.thumbnail?.source;
    return img || null;
  } catch { return null; }
}

function coverUrl(idOrUrl, size = 'M') {
  // For Google Books we store the full URL directly
  if (!idOrUrl) return null;
  if (idOrUrl.startsWith('http')) return idOrUrl;
  // Legacy Open Library ID fallback
  return `https://covers.openlibrary.org/b/id/${idOrUrl}-${size}.jpg`;
}

// ─── ROUTER ──────────────────────────────────────────────────────────────
function navigate(page, params = {}) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  state.currentPage = page;
  window.scrollTo(0, 0);

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.querySelector(`nav a[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  if (page === 'home') {
    loadHomePage();
  } else if (page === 'search') {
    if (params.query) {
      document.getElementById('main-search-input').value = params.query;
      doSearch(params.query);
    }
  } else if (page === 'book') {
    loadBookDetail(params.book || state.currentBook);
  } else if (page === 'list-detail') {
    loadListDetail(params.listId);
  } else if (page === 'profile') {
    loadProfilePage();
  } else if (page === 'lists') {
    loadListsPreviews();
  }
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────
let homeLoaded = false;

// Curated shelves — hand-picked titles with reliable, great-looking covers
const SHELF_POPULAR = [
  { title: 'The Hunger Games', author: 'Collins' },
  { title: 'Gone Girl', author: 'Flynn' },
  { title: 'The Girl with the Dragon Tattoo', author: 'Larsson' },
  { title: 'The Da Vinci Code', author: 'Brown' },
  { title: 'Harry Potter and the Philosophers Stone', author: 'Rowling' },
  { title: 'The Fault in Our Stars', author: 'Green' },
  { title: 'Educated', author: 'Westover' },
  { title: 'Sapiens', author: 'Harari' },
  { title: 'Atomic Habits', author: 'Clear' },
  { title: 'The Alchemist', author: 'Coelho' },
  { title: 'Dune', author: 'Herbert' },
  { title: 'The Hobbit', author: 'Tolkien' },
  { title: 'A Little Life', author: 'Yanagihara' },
  { title: 'Normal People', author: 'Rooney' },
  { title: 'The Thursday Murder Club', author: 'Osman' },
  { title: 'Tomorrow and Tomorrow and Tomorrow', author: 'Zevin' },
];

const SHELF_CLASSICS = [
  { title: 'To Kill a Mockingbird', author: 'Lee' },
  { title: '1984', author: 'Orwell' },
  { title: 'The Great Gatsby', author: 'Fitzgerald' },
  { title: 'One Hundred Years of Solitude', author: 'Marquez' },
  { title: 'Crime and Punishment', author: 'Dostoevsky' },
  { title: 'Brave New World', author: 'Huxley' },
  { title: 'Anna Karenina', author: 'Tolstoy' },
  { title: 'Moby Dick', author: 'Melville' },
  { title: 'The Catcher in the Rye', author: 'Salinger' },
  { title: 'Middlemarch', author: 'Eliot' },
  { title: 'Pride and Prejudice', author: 'Austen' },
  { title: 'Jane Eyre', author: 'Bronte' },
  { title: 'Wuthering Heights', author: 'Bronte' },
  { title: 'Ulysses', author: 'Joyce' },
  { title: 'Don Quixote', author: 'Cervantes' },
  { title: 'The Brothers Karamazov', author: 'Dostoevsky' },
];

const SHELF_FICTION = [
  { title: 'Dune', author: 'Herbert' },
  { title: 'The Hitchhikers Guide to the Galaxy', author: 'Adams' },
  { title: 'Foundation', author: 'Asimov' },
  { title: 'Neuromancer', author: 'Gibson' },
  { title: 'The Left Hand of Darkness', author: 'Le Guin' },
  { title: 'Enders Game', author: 'Card' },
  { title: 'The Martian', author: 'Weir' },
  { title: 'Annihilation', author: 'VanderMeer' },
  { title: 'Project Hail Mary', author: 'Weir' },
  { title: 'The Road', author: 'McCarthy' },
  { title: 'Never Let Me Go', author: 'Ishiguro' },
  { title: 'Blindsight', author: 'Watts' },
  { title: 'A Canticle for Leibowitz', author: 'Miller' },
  { title: 'The Stars My Destination', author: 'Bester' },
  { title: 'Flowers for Algernon', author: 'Keyes' },
  { title: 'Slaughterhouse Five', author: 'Vonnegut' },
];

async function loadHomePage() {
  if (homeLoaded) return;
  renderShelfSkeletons('popular-books-grid', 16);
  renderShelfSkeletons('classics-books-grid', 16);
  renderShelfSkeletons('fiction-books-grid', 16);

  try {
    const [popular, classics, fiction] = await Promise.all([
      getCuratedShelf(SHELF_POPULAR),
      getCuratedShelf(SHELF_CLASSICS),
      getCuratedShelf(SHELF_FICTION),
    ]);
    state.popularBooks = popular;
    state.classicsBooks = classics;
    state.fictionBooks = fiction;
    renderShelfBooks('popular-books-grid', popular);
    renderShelfBooks('classics-books-grid', classics);
    renderShelfBooks('fiction-books-grid', fiction);
    homeLoaded = true;
  } catch (e) {
    showToast('Could not load books. Check your connection.', 'error');
  }
}

function renderShelfSkeletons(containerId, count) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array.from({length: count}, () => `
    <div style="flex:0 0 auto;width:110px;margin-right:6px">
      <div class="skeleton skeleton-cover" style="width:110px"></div>
    </div>
  `).join('');
}

function renderShelfBooks(containerId, books) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = books.map(book => shelfBookHTML(book)).join('');
  // bind events
  el.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.overlay-btn')) return;
      const book = findBookByKey(card.dataset.key) || books.find(b => b.key === card.dataset.key);
      if (book) openBook(book);
    });
  });
  el.querySelectorAll('.overlay-btn.mark-read').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleRead(btn.dataset.key, btn.dataset.title, btn.dataset.author, btn.dataset.cover, btn.dataset.year);
      // update badge
      const card = el.querySelector(`.book-card[data-key="${CSS.escape(btn.dataset.key)}"]`);
      if (card) refreshCardBadge(card, btn.dataset.key);
    });
  });
  el.querySelectorAll('.overlay-btn.rate-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const book = books.find(b => b.key === btn.dataset.key);
      if (book) openRatingModal(book);
    });
  });
}

function shelfBookHTML(book) {
  const isRead = !!state.readBooks[book.key];
  const cover = coverUrl(book.coverUrl);
  return `
    <div class="book-card" data-key="${escHtml(book.key)}">
      <div class="book-cover-wrap">
        ${cover
          ? `<img class="book-cover" src="${cover}" alt="${escHtml(book.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <div class="book-cover-placeholder" ${cover ? 'style="display:none"' : ''}>
          <svg width="20" height="28" viewBox="0 0 24 32" fill="none"><rect x="0" y="0" width="24" height="32" rx="2" fill="#3a4555"/><rect x="3" y="4" width="18" height="2" rx="1" fill="#67788a"/><rect x="3" y="9" width="14" height="2" rx="1" fill="#67788a"/></svg>
          <span class="placeholder-title">${escHtml(book.title)}</span>
        </div>
        <div class="book-overlay">
          <div class="overlay-actions">
            <button class="overlay-btn mark-read ${isRead ? 'read' : ''}"
              data-key="${escHtml(book.key)}" data-title="${escHtml(book.title)}"
              data-author="${escHtml(book.author)}" data-cover="${book.coverUrl || ''}"
              data-year="${book.year || ''}" title="${isRead ? 'Mark unread' : 'Mark as read'}">
              ${isRead ? '✓' : '📖'}
            </button>
            <button class="overlay-btn rate-btn" data-key="${escHtml(book.key)}" title="Rate">★</button>
          </div>
        </div>
        ${isRead ? '<div class="read-badge">✓</div>' : ''}
      </div>
    </div>
  `;
}

function refreshCardBadge(card, key) {
  const isRead = !!state.readBooks[key];
  const existing = card.querySelector('.read-badge');
  if (isRead && !existing) {
    const badge = document.createElement('div');
    badge.className = 'read-badge';
    badge.textContent = '✓';
    card.querySelector('.book-cover-wrap').appendChild(badge);
  } else if (!isRead && existing) {
    existing.remove();
  }
  const btn = card.querySelector('.overlay-btn.mark-read');
  if (btn) {
    btn.className = `overlay-btn mark-read ${isRead ? 'read' : ''}`;
    btn.textContent = isRead ? '✓' : '📖';
  }
}

// ─── SHELF ARROWS ─────────────────────────────────────────────────────────
function initShelfArrows() {
  document.querySelectorAll('.shelf-arrow').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const shelf = document.getElementById(targetId);
      const track = shelf?.querySelector('.shelf-track');
      if (!track) return;
      const scrollAmt = 600;
      if (btn.classList.contains('shelf-arrow-left')) {
        track.scrollBy({ left: -scrollAmt, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: scrollAmt, behavior: 'smooth' });
      }
    });
  });
}

// ─── LISTS PAGE ───────────────────────────────────────────────────────────
async function loadListsPreviews() {
  const listIds = ['lemonde', 'modernlibrary', 'telegraph', 'bbc', 'time', 'guardian'];
  for (const id of listIds) {
    const list = CURATED_LISTS[id];
    const previewEl = document.getElementById(`${id}-preview`);
    if (!previewEl || previewEl.dataset.loaded) continue;
    previewEl.dataset.loaded = '1';

    // show 5 placeholder slots immediately
    previewEl.innerHTML = list.books.slice(0, 5).map(() =>
      `<div class="list-placeholder-cover">📚</div>`
    ).join('');

    // fetch covers for first 5
    const first5 = list.books.slice(0, 5);
    for (let i = 0; i < first5.item; i++) {
      const b = first5[i];
    }

    // search first 5 books in parallel
    const results = await Promise.allSettled(
      first5.map(b => searchBooksForList(b.title, b.author))
    );

    const slots = previewEl.querySelectorAll('.list-placeholder-cover');
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value && r.value.coverUrl) {
        const img = document.createElement('img');
        img.src = coverUrl(r.value.coverUrl, 'S');
        img.alt = first5[i].title;
        img.style.flex = '1';
        img.style.objectFit = 'cover';
        img.style.borderRight = '2px solid var(--bg-primary)';
        slots[i]?.replaceWith(img);
      }
    });
  }
}

function openList(listId) {
  state.currentList = listId;
  navigate('list-detail', { listId });
}

async function loadListDetail(listId) {
  const list = CURATED_LISTS[listId];
  if (!list) return;

  const readCount = list.books.filter(b =>
    Object.values(state.readBooks).some(rb => rb.title.toLowerCase() === b.title.toLowerCase())
  ).length;
  const pct = Math.round((readCount / list.books.length) * 100);

  document.getElementById('list-detail-content').innerHTML = `
    <div class="list-detail-header">
      <div class="list-detail-header-inner">
        <button class="list-detail-back" onclick="navigate('lists')">← Back to Lists</button>
        <div class="list-detail-title">${escHtml(list.title)}</div>
        <div class="list-detail-meta">${escHtml(list.source)} · ${list.books.length} books · ${escHtml(list.year)}</div>
        <p style="color:var(--text-muted);font-size:14px;max-width:600px;margin-top:10px;line-height:1.6">${escHtml(list.desc)}</p>
        <div class="list-progress-bar-wrap">
          <div class="list-progress-label">${readCount} of ${list.books.length} read (${pct}%)</div>
          <div class="list-progress-bar"><div class="list-progress-fill" style="width:${pct}%"></div></div>
        </div>
      </div>
    </div>
    <div style="max-width:1200px;margin:0 auto;padding:32px 20px 60px">
      <div id="list-detail-books" class="list-detail-grid">
        ${list.books.map((b, i) => `
          <div class="list-grid-card list-book-row" data-idx="${i}" data-title="${escHtml(b.title)}" data-author="${escHtml(b.author)}">
            <div class="list-grid-cover-wrap">
              <div class="list-grid-cover-placeholder" id="list-cover-${i}">
                <div class="list-grid-num">${i+1}</div>
              </div>
              <div class="list-grid-overlay">
                <div class="overlay-actions">
                  <button class="overlay-btn list-mark-read" data-idx="${i}" title="Mark as read">📖</button>
                </div>
              </div>
              ${Object.values(state.readBooks).some(rb => rb.title.toLowerCase() === b.title.toLowerCase())
                ? '<div class="read-badge" id="list-read-badge-' + i + '">✓</div>'
                : '<div id="list-read-badge-' + i + '"></div>'}
            </div>
            <div class="list-grid-info">
              <div class="list-grid-num-label">${i+1}</div>
              <div class="list-grid-title">${escHtml(b.title)}</div>
              <div class="list-grid-author">${escHtml(b.author)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  loadListCovers(list.books);
}

async function loadListCovers(books) {
  const batchSize = 8;
  for (let i = 0; i < books.length; i += batchSize) {
    const batch = books.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(b => searchBooksForList(b.title, b.author))
    );
    results.forEach((r, j) => {
      const idx = i + j;
      const el = document.getElementById(`list-cover-${idx}`);
      if (!el) return;
      if (r.status === 'fulfilled' && r.value) {
        const book = r.value;
        // Store fetched book on the card for click handler
        const card = el.closest('.list-book-row');
        if (card) {
          card._book = book;
          card.onclick = (e) => { if (!e.target.closest('.overlay-btn')) openBook(book); };
        }
        if (book.coverUrl) {
          el.outerHTML = `<img id="list-cover-${idx}" src="${book.coverUrl}" alt="${escHtml(book.title)}" class="list-grid-cover-img" onerror="this.style.display='none'">`;
        }
        // Bind mark-read button
        const readBtn = document.querySelector(`.list-mark-read[data-idx="${idx}"]`);
        if (readBtn) {
          const isRead = Object.values(state.readBooks).some(rb => rb.title.toLowerCase() === book.title.toLowerCase());
          if (isRead) { readBtn.textContent = '✓'; readBtn.classList.add('read'); }
          readBtn.onclick = (e) => {
            e.stopPropagation();
            toggleRead(book.key || book.title, book.title, book.author, book.coverUrl, book.year);
            const nowRead = !!state.readBooks[book.key || book.title];
            readBtn.textContent = nowRead ? '✓' : '📖';
            readBtn.classList.toggle('read', nowRead);
            const badge = document.getElementById(`list-read-badge-${idx}`);
            if (badge) badge.innerHTML = nowRead ? '<div class="read-badge" style="position:static;width:16px;height:16px;font-size:8px">✓</div>' : '';
          };
        }
      }
    });
  }
}

// ─── BOOK DETAIL ───────────────────────────────────────────────────────────
async function openBook(book) {
  state.currentBook = book;
  navigate('book', { book });
}

async function loadBookDetail(book) {
  if (!book) return;
  const isRead = !!state.readBooks[book.key];
  const rating = state.ratings[book.key] || 0;
  const isFav = state.favorites.some(f => f.key === book.key);
  const cover = coverUrl(book.coverUrl, 'L');

  document.getElementById('book-detail-content').innerHTML = `
    <div class="book-detail-backdrop">
      <div class="book-detail-inner">
        <div>
          ${cover ? `<img class="book-detail-cover" id="detail-cover-img" src="${cover}" alt="${escHtml(book.title)}" onerror="this.style.display='none';document.getElementById('detail-cover-placeholder').style.display='flex'">` : ''}
          <div class="book-detail-cover-placeholder" id="detail-cover-placeholder" ${cover ? 'style="display:none"' : ''}>
            <svg width="48" height="64" viewBox="0 0 24 32" fill="none"><rect x="0" y="0" width="24" height="32" rx="2" fill="#3a4555"/></svg>
            <p>${escHtml(book.title)}</p>
          </div>
        </div>
        <div class="book-detail-info">
          ${book.year ? `<div class="book-detail-year">${book.year}</div>` : ''}
          <h1 class="book-detail-title">${escHtml(book.title)}</h1>
          <div class="book-detail-author">by <a href="#">${escHtml(book.author)}</a></div>
          <div class="detail-meta">
            ${book.pages ? `<div class="meta-item"><span class="meta-label">Pages</span><span class="meta-value">${book.pages}</span></div>` : ''}
            <div class="meta-item"><span class="meta-label">Status</span><span class="meta-value" id="detail-status">${isRead ? '✓ Read' : '— Not read'}</span></div>
          </div>
          <div class="detail-actions">
            <button class="detail-action-btn ${isRead ? 'active-read' : ''}" id="detail-read-btn">
              <span>${isRead ? '✓' : '+'}</span> ${isRead ? 'Read' : 'Mark as Read'}
            </button>
            <button class="detail-action-btn ${isFav ? 'active-fav' : ''}" id="detail-fav-btn">
              <span>♥</span> ${isFav ? 'Favorited' : 'Add to Favorites'}
            </button>
            <div class="detail-rating">
              <span class="detail-rating-label">Rate:</span>
              ${[1,2,3,4,5].map(i => `<span class="detail-star ${i <= rating ? 'filled' : ''}" data-val="${i}">★</span>`).join('')}
            </div>
          </div>
          <div id="detail-description" class="book-description">
            <span style="color:var(--text-muted);font-style:italic">Loading description…</span>
          </div>
        </div>
      </div>
    </div>
    <div class="detail-tabs-section">
      <div class="tabs"><button class="tab-btn active">Overview</button></div>
    </div>
  `;

  bindDetailActions(book);
  fetchAndRenderDescription(book.key);
}

function bindDetailActions(book) {
  document.getElementById('detail-read-btn')?.addEventListener('click', () => {
    toggleRead(book.key, book.title, book.author, book.coverUrl, book.year);
    const isRead = !!state.readBooks[book.key];
    const btn = document.getElementById('detail-read-btn');
    const statusEl = document.getElementById('detail-status');
    if (btn) { btn.className = `detail-action-btn ${isRead ? 'active-read' : ''}`; btn.innerHTML = `<span>${isRead ? '✓' : '+'}</span> ${isRead ? 'Read' : 'Mark as Read'}`; }
    if (statusEl) statusEl.textContent = isRead ? '✓ Read' : '— Not read';
  });

  document.getElementById('detail-fav-btn')?.addEventListener('click', () => {
    toggleFavorite(book);
    const isFav = state.favorites.some(f => f.key === book.key);
    const btn = document.getElementById('detail-fav-btn');
    if (btn) { btn.className = `detail-action-btn ${isFav ? 'active-fav' : ''}`; btn.innerHTML = `<span>♥</span> ${isFav ? 'Favorited' : 'Add to Favorites'}`; }
  });

  const stars = document.querySelectorAll('.detail-star');
  stars.forEach(star => {
    star.addEventListener('mouseenter', () => { const val = parseInt(star.dataset.val); stars.forEach((s, i) => s.classList.toggle('hover-fill', i < val)); });
    star.addEventListener('mouseleave', () => { stars.forEach(s => s.classList.remove('hover-fill')); });
    star.addEventListener('click', () => {
      const val = parseInt(star.dataset.val);
      const current = state.ratings[book.key] || 0;
      state.ratings[book.key] = current === val ? 0 : val;
      save();
      stars.forEach((s, i) => s.classList.toggle('filled', i < state.ratings[book.key]));
      showToast(state.ratings[book.key] ? `Rated "${book.title}" ${state.ratings[book.key]}★` : 'Rating removed', 'info');
    });
  });
}

async function fetchAndRenderDescription(key) {
  try {
    // If the current book already has a description (from Google Books), use it directly
    const existing = state.currentBook?.description;
    let desc = existing || '';
    if (!desc) {
      const data = await fetchBookDetails(key);
      if (typeof data.description === 'string') desc = data.description;
      else if (data.description?.value) desc = data.description.value;
      // Google Books API volumeInfo.description
      else if (data.volumeInfo?.description) desc = data.volumeInfo.description;
    }
    desc = desc.replace(/\([^)]*\)/g, '').replace(/https?:\/\/\S+/g, '').trim();
    const el = document.getElementById('detail-description');
    if (!el) return;
    if (!desc) { el.innerHTML = `<span style="color:var(--text-muted);font-style:italic">No description available.</span>`; return; }
    el.classList.add('collapsed');
    el.textContent = desc;
    const btn = document.createElement('button');
    btn.className = 'read-more-btn';
    btn.textContent = 'Show more';
    btn.onclick = () => { const c = el.classList.toggle('collapsed'); btn.textContent = c ? 'Show more' : 'Show less'; };
    el.after(btn);
  } catch (e) {
    const el = document.getElementById('detail-description');
    if (el) el.innerHTML = `<span style="color:var(--text-muted);font-style:italic">No description available.</span>`;
  }
}

// ─── SEARCH ───────────────────────────────────────────────────────────────
async function doSearch(query) {
  if (!query.trim()) return;
  state.searchQuery = query;
  document.getElementById('search-results-info').textContent = 'Searching…';
  renderGridSkeletons('search-results-grid', 12);

  try {
    const results = await searchBooks(query, 24);
    state.searchResults = results;
    document.getElementById('search-results-info').textContent = `${results.length} results for "${query}"`;
    renderBookGrid('search-results-grid', results);
  } catch (e) {
    document.getElementById('search-results-info').textContent = 'Search failed. Try again.';
    showToast('Search failed', 'error');
  }
}

function renderGridSkeletons(containerId, count) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array.from({length: count}, () => `
    <div><div class="skeleton skeleton-cover"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div></div>
  `).join('');
}

function renderBookGrid(containerId, books) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!books.length) { el.innerHTML = `<div class="empty-state"><p>No books found.</p></div>`; return; }
  el.innerHTML = books.map(book => bookCardHTML(book)).join('');
  el.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.overlay-btn')) return;
      const book = books.find(b => b.key === card.dataset.key);
      if (book) openBook(book);
    });
  });
  el.querySelectorAll('.overlay-btn.mark-read').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleRead(btn.dataset.key, btn.dataset.title, btn.dataset.author, btn.dataset.cover, btn.dataset.year);
    });
  });
  el.querySelectorAll('.overlay-btn.rate-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const book = books.find(b => b.key === btn.dataset.key);
      if (book) openRatingModal(book);
    });
  });
}

function bookCardHTML(book) {
  const isRead = !!state.readBooks[book.key];
  const rating = state.ratings[book.key] || 0;
  const cover = coverUrl(book.coverUrl);
  const starsHtml = [1,2,3,4,5].map(i => `<span class="star ${i <= rating ? 'filled' : ''}">★</span>`).join('');
  return `
    <div class="book-card" data-key="${escHtml(book.key)}">
      <div class="book-cover-wrap">
        ${cover ? `<img class="book-cover" src="${cover}" alt="${escHtml(book.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <div class="book-cover-placeholder" ${cover ? 'style="display:none"' : ''}>
          <svg width="24" height="32" viewBox="0 0 24 32" fill="none"><rect x="0" y="0" width="24" height="32" rx="2" fill="#3a4555"/><rect x="3" y="4" width="18" height="2" rx="1" fill="#67788a"/><rect x="3" y="9" width="14" height="2" rx="1" fill="#67788a"/></svg>
          <span class="placeholder-title">${escHtml(book.title)}</span>
        </div>
        <div class="book-overlay">
          <div class="overlay-actions">
            <button class="overlay-btn mark-read ${isRead ? 'read' : ''}" data-key="${escHtml(book.key)}" data-title="${escHtml(book.title)}" data-author="${escHtml(book.author)}" data-cover="${book.coverUrl || ''}" data-year="${book.year || ''}">${isRead ? '✓' : '📖'}</button>
            <button class="overlay-btn rate-btn ${rating ? 'rated' : ''}" data-key="${escHtml(book.key)}">★</button>
          </div>
        </div>
        ${isRead ? '<div class="read-badge">✓</div>' : ''}
      </div>
      <div class="book-info">
        <div class="book-title">${escHtml(book.title)}</div>
        <div class="book-author">${escHtml(book.author)}</div>
        ${rating ? `<div class="book-rating">${starsHtml}</div>` : ''}
      </div>
    </div>
  `;
}

// ─── PROFILE ──────────────────────────────────────────────────────────────
function loadProfilePage() {
  const readCount = Object.keys(state.readBooks).length;
  const ratedCount = Object.keys(state.ratings).filter(k => state.ratings[k] > 0).length;
  const favCount = state.favorites.length;
  document.getElementById('stat-read').textContent = readCount;
  document.getElementById('stat-rated').textContent = ratedCount;
  document.getElementById('stat-favs').textContent = favCount;
  document.getElementById('profile-username').textContent = state.username;
  document.getElementById('profile-avatar-letter').textContent = state.username[0].toUpperCase();
  renderFavorites();
  renderReadList();
}

function renderFavorites() {
  const grid = document.getElementById('favorites-grid');
  if (!grid) return;
  grid.innerHTML = [0,1,2,3].map(i => {
    const fav = state.favorites[i];
    if (fav) {
      const cover = coverUrl(fav.coverUrl, 'M');
      return `
        <div class="fav-slot filled" data-slot="${i}">
          ${cover ? `<img src="${cover}" alt="${escHtml(fav.title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
          <div class="fav-slot-placeholder" ${cover ? 'style="display:none"' : ''}><span>${escHtml(fav.title)}</span></div>
          <div class="fav-slot-overlay"><button onclick="removeFavorite(${i})">Remove</button></div>
        </div>`;
    } else {
      return `<div class="fav-slot" data-slot="${i}" onclick="navigate('search')">
        <div class="fav-slot-empty">
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          <span>Add a favourite</span>
        </div>
      </div>`;
    }
  }).join('');
}

function removeFavorite(index) {
  state.favorites.splice(index, 1);
  save();
  renderFavorites();
  showToast('Removed from favourites');
}

function renderReadList() {
  const el = document.getElementById('read-books-list');
  if (!el) return;
  const keys = Object.keys(state.readBooks);
  if (!keys.length) {
    el.innerHTML = `<div class="empty-state"><svg width="48" height="48" fill="none" viewBox="0 0 24 24"><path d="M4 19V6a2 2 0 012-2h12a2 2 0 012 2v13" stroke="currentColor" stroke-width="1.5"/></svg><h3>No books read yet</h3><p>Search for a book and mark it as read</p></div>`;
    return;
  }
  el.innerHTML = keys.map(key => {
    const b = state.readBooks[key];
    const rating = state.ratings[key] || 0;
    const cover = coverUrl(b.coverUrl);
    const starsHtml = [1,2,3,4,5].map(i => `<span class="star ${i <= rating ? 'filled' : ''}">★</span>`).join('');
    return `
      <div class="book-list-item" onclick="openBook(${JSON.stringify(b).replace(/"/g, '&quot;')})">
        ${cover ? `<img class="book-list-cover" src="${cover}" alt="${escHtml(b.title)}" onerror="this.style.display='none'">` : `<div class="book-list-cover-placeholder"><svg width="16" height="22" viewBox="0 0 24 32" fill="none"><rect x="0" y="0" width="24" height="32" rx="2" fill="#3a4555"/></svg></div>`}
        <div class="book-list-info">
          <div class="book-list-title">${escHtml(b.title)}</div>
          <div class="book-list-author">${escHtml(b.author)}</div>
          ${b.dateRead ? `<div class="date-read">Read ${b.dateRead}</div>` : ''}
        </div>
        <div class="book-list-rating">${starsHtml}</div>
      </div>`;
  }).join('');
}

// ─── ACTIONS ──────────────────────────────────────────────────────────────
function toggleRead(key, title, author, coverUrl, year) {
  if (state.readBooks[key]) {
    delete state.readBooks[key];
    showToast(`Removed "${title}" from read list`);
  } else {
    const dateRead = new Date().toLocaleDateString('en-NL', { month: 'short', year: 'numeric' });
    state.readBooks[key] = { key, title, author, coverUrl, year, dateRead };
    showToast(`Marked "${title}" as read ✓`);
  }
  save();
}

function toggleFavorite(book) {
  const idx = state.favorites.findIndex(f => f.key === book.key);
  if (idx >= 0) {
    state.favorites.splice(idx, 1);
    showToast('Removed from favourites');
  } else {
    if (state.favorites.length >= 4) { showToast('You can only have 4 favourites. Remove one first.', 'error'); return; }
    state.favorites.push({ key: book.key, title: book.title, author: book.author, coverUrl: book.coverUrl });
    showToast(`Added "${book.title}" to favourites ♥`);
  }
  save();
}

function findBookByKey(key) {
  return [...state.popularBooks, ...state.classicsBooks, ...state.fictionBooks, ...state.searchResults].find(b => b.key === key);
}

// ─── RATING MODAL ────────────────────────────────────────────────────────
function openRatingModal(book) {
  state.pendingRatingBook = book;
  document.getElementById('modal-book-title').textContent = book.title;
  const cur = state.ratings[book.key] || 0;
  document.querySelectorAll('.modal-star').forEach(s => s.classList.toggle('filled', parseInt(s.dataset.val) <= cur));
  document.getElementById('rating-modal').classList.add('open');
}

function closeRatingModal() {
  document.getElementById('rating-modal').classList.remove('open');
  state.pendingRatingBook = null;
}

function saveRating(val) {
  const book = state.pendingRatingBook;
  if (!book) return;
  state.ratings[book.key] = (state.ratings[book.key] === val) ? 0 : val;
  save();
  closeRatingModal();
  showToast(state.ratings[book.key] ? `Rated ${state.ratings[book.key]}★` : 'Rating removed');
}

// ─── TOAST ────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : type === 'info' ? 'info' : ''}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ─── UTILS ────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─── INIT ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Nav
  document.querySelectorAll('nav a[data-page]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); navigate(a.dataset.page); });
  });

  document.getElementById('logo-link')?.addEventListener('click', e => { e.preventDefault(); navigate('home'); });
  document.getElementById('profile-nav-link')?.addEventListener('click', e => { e.preventDefault(); navigate('profile'); });

  // Header search
  document.getElementById('header-search')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) navigate('search', { query: e.target.value.trim() });
  });

  // Search page
  document.getElementById('search-btn')?.addEventListener('click', () => {
    const q = document.getElementById('main-search-input').value.trim();
    if (q) doSearch(q);
  });
  document.getElementById('main-search-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) doSearch(e.target.value.trim());
  });
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      document.getElementById('main-search-input').value = chip.dataset.genre;
      doSearch(chip.dataset.genre);
    });
  });

  // Hero
  document.getElementById('hero-search-btn')?.addEventListener('click', () => { navigate('search'); setTimeout(() => document.getElementById('main-search-input')?.focus(), 100); });
  document.getElementById('hero-profile-btn')?.addEventListener('click', () => navigate('profile'));

  // Rating modal stars
  document.querySelectorAll('.modal-star').forEach(star => {
    star.addEventListener('mouseenter', () => {
      const val = parseInt(star.dataset.val);
      document.querySelectorAll('.modal-star').forEach((s, i) => s.classList.toggle('hover-fill', i < val));
    });
    star.addEventListener('mouseleave', () => {
      document.querySelectorAll('.modal-star').forEach(s => s.classList.remove('hover-fill'));
      const book = state.pendingRatingBook;
      if (book) {
        const cur = state.ratings[book.key] || 0;
        document.querySelectorAll('.modal-star').forEach(s => s.classList.toggle('filled', parseInt(s.dataset.val) <= cur));
      }
    });
    star.addEventListener('click', () => saveRating(parseInt(star.dataset.val)));
  });
  document.getElementById('modal-cancel')?.addEventListener('click', closeRatingModal);
  document.getElementById('rating-modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeRatingModal(); });

  // Profile editing
  document.getElementById('edit-username-btn')?.addEventListener('click', () => {
    const form = document.getElementById('edit-name-form');
    const input = document.getElementById('username-input');
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
    if (input) { input.value = state.username; input.focus(); }
  });
  document.getElementById('save-username-btn')?.addEventListener('click', () => {
    const val = document.getElementById('username-input').value.trim();
    if (val) {
      state.username = val; save();
      document.getElementById('profile-username').textContent = val;
      document.getElementById('profile-avatar-letter').textContent = val[0].toUpperCase();
      document.getElementById('profile-avatar-small').textContent = val[0].toUpperCase();
      document.getElementById('edit-name-form').style.display = 'none';
      showToast('Username updated!');
    }
  });

  document.getElementById('profile-avatar-small').textContent = state.username[0].toUpperCase();

  // Shelf arrows
  initShelfArrows();

  navigate('home');
});

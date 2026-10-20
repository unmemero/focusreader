use anyhow::{Context, Result};
use tracing::info;

use crate::{
    db::DbManager,
    services::corpus::{calculate_lexical_density, count_words},
};

pub struct SeedPassage {
    pub id: &'static str,
    pub title: &'static str,
    pub domain: &'static str,
    pub source_attribution: &'static str,
    pub passage_text: &'static str,
}

pub const SEED_PASSAGES: &[SeedPassage] = &[
    // --- COMPUTER SCIENCE ---
    SeedPassage {
        id: "seed_cs_rfc9110",
        title: "HTTP Architecture: Intermediaries and Caching",
        domain: "computer_science",
        source_attribution: "RFC 9110 (HTTP Semantics, Sections 3.7 & 7.1)",
        passage_text: "HTTP relies on the Uniform Resource Identifier (URI) standard to identify target resources and define relationships across the web. Rather than requiring a direct wire between every client and server, HTTP messages travel in a uniform request-and-response format across chains of intermediaries, including proxies, gateways, and tunnels. Because every intermediary speaks the same message semantics, the network can inspect, route, or optimize traffic without altering the core application logic on the origin server.\n\nA foundational optimization enabled by this architecture is HTTP caching. An HTTP cache is a local store of response messages paired with a subsystem that governs how those messages are stored, retrieved, and evicted. Caching eliminates the need to send every request all the way to the origin server, dramatically reducing round-trip network latency for the reader and decreasing bandwidth and compute load across the network. Responses may be held in a shared cache, such as a reverse proxy or content delivery node serving thousands of users, or in a private cache, such as a single web browser storing assets for one user.\n\nHowever, caching introduces a fundamental engineering trade-off between speed and data freshness. If a cached response becomes stale because the underlying resource on the origin server has changed, serving the cached copy risks delivering outdated information. To resolve this, HTTP separates cache lifetime from cache validation. Origin servers attach explicit freshness directives, such as max-age headers, alongside validation tokens known as entity tags (ETags). When a cached representation expires, the cache does not immediately discard the data; instead, it sends a conditional request to the origin server asking whether the token still matches. If the resource is unchanged, the server replies with a lightweight '304 Not Modified' signal, allowing the cache to reuse its local copy safely. Finally, the semantics of HTTP methods dictate which responses can be cached by default: safe, idempotent retrieval methods like GET are cacheable, whereas state-changing methods like POST bypass the cache to preserve data integrity.",
    },
    SeedPassage {
        id: "seed_cs_shannon1948",
        title: "The Fundamental Problem of Communication",
        domain: "computer_science",
        source_attribution: "Claude E. Shannon, 'A Mathematical Theory of Communication' (Bell System Technical Journal, 1948)",
        passage_text: "The fundamental problem of communication is that of reproducing at one point, either exactly or approximately, a message selected at another point. Frequently the messages have meaning; that is, they refer to or are correlated with physical ideas or conceptual thoughts in the real world. However, these semantic aspects of communication—what the words actually mean to a human reader—are irrelevant to the engineering problem. The crucial insight is that the actual message transmitted is always one chosen from a set of possible messages. A communication system must be designed to operate for every possible selection, not merely the single message that happens to be sent at a given moment, since the sender's choice is unknown when the system is built.\n\nTo analyze any communication system mathematically, we can break it into five essential parts. First, an information source selects a desired message out of a set of possible messages—such as text, speech, or images. Second, a transmitter converts this message into a physical signal suitable for transmission, such as changing sound pressure into an electrical current or encoding letters into binary pulses. Third, the channel is the medium—such as a copper wire, optical fiber, or radio band—used to carry the signal from transmitter to receiver, during which unwanted random disturbances, called noise, may corrupt the signal. Fourth, the receiver performs the inverse operation of the transmitter, reconstructing the message from the received signal. Fifth, the destination is the person or device for whom the message is intended.\n\nBecause the system must handle any possible choice from the message set, information can be measured purely by the amount of uncertainty or freedom of choice involved in selecting a message. If a set contains only two equally likely messages—like a coin flip—choosing one resolves a single binary decision. As was first pointed out by Hartley, the most natural mathematical measure of this choice is the logarithmic function, which measures information in binary digits, or 'bits.' Although measuring information by the number of possible messages rather than by human meaning at first seems counterintuitive, it is the only definition that satisfies the practical engineering requirement of additivity: combining two independent binary switches doubles the number of possible states from two to four, while cleanly adding their information capacity from one bit to two bits.",
    },
    SeedPassage {
        id: "seed_cs_turing1950",
        title: "The Imitation Game and Thinking Machines",
        domain: "computer_science",
        source_attribution: "Alan Turing, 'Computing Machinery and Intelligence' (Mind, 1950)",
        passage_text: "I propose to consider the question, 'Can machines think?' Traditionally, such an inquiry begins with definitions of the terms 'machine' and 'think.' Yet framing definitions to reflect ordinary everyday usage is a trap: if the meaning of the words is decided by how people commonly use them in conversation, then answering whether machines think would be reduced to taking a statistical opinion survey, like a Gallup poll. That approach is scientifically barren because it tests popular linguistic habits rather than the actual capabilities of computing machinery. Instead of debating vague philosophical definitions, I shall replace the original question with an operational test expressed in unambiguous terms.\n\nThe new form of the problem can be described in terms of a game which we call the 'imitation game.' It is played with three participants: a man (Player A), a woman (Player B), and an interrogator (Player C) who may be of either sex. The interrogator stays in a closed room apart from the other two and communicates with them only through written text—ideally via a teleprinter—so that tone of voice and physical appearance provide no clues. The object of the game for the interrogator is to determine which of the other two players is the man and which is the woman by asking them any questions whatsoever. Player A's goal is to trick the interrogator into making the wrong identification, while Player B's goal is to help the interrogator succeed.\n\nWe now ask the decisive question: What will happen when a digital computer takes the part of Player A in this game? Will the interrogator decide wrongly as often when the game is played with a machine as when it is played between a man and a woman? This reformulation has the major advantage of drawing a sharp dividing line between the physical and the intellectual capacities of a human being. No engineer claims to be able to build a material indistinguishable from human skin and muscle, and doing so would add nothing to our understanding of intelligence. By restricting interaction to written questions and answers across virtually any topic—from poetry and arithmetic to strategy—the imitation game tests whether a machine can generate behavior functionally indistinguishable from human thought.",
    },
    SeedPassage {
        id: "seed_cs_dijkstra1968",
        title: "On the Harm of Unbridled Branching",
        domain: "computer_science",
        source_attribution: "Edsger W. Dijkstra, 'Go To Statement Considered Harmful' (Communications of the ACM, 1968)",
        passage_text: "For a number of years I have observed that the quality and reliability of software programs is inversely related to the density of 'go to' statements written by their programmers. More recently I discovered the underlying cognitive reason why arbitrary branching has such disastrous effects, convincing me that the unrestrained 'go to' statement should be abolished from all higher-level programming languages.\n\nMy first observation is that while a programmer's work ends once they have written a static piece of source code on a page, the true subject of their concern is the dynamic process that unfolds over time when the computer executes that code. Human intellectual powers are reasonably well suited to understanding static relationships on a page, but our ability to visualize complex processes evolving step by step across time is comparatively weak. For that reason, software design must strive to narrow the conceptual gap between the static program text and the dynamic execution process, making the correspondence between where we are on the printed page and where the computer is in time as direct and transparent as possible.\n\nConsider how we determine the state of a running program at any arbitrary moment. If a program uses only structured control flow—sequential statements, clear conditional branches (if-then-else), well-defined subroutines, and bounded loops (while or for)—we can pinpoint the exact state of execution using a small set of predictable progress coordinates: the line number in the text, the call stack of active procedures, and a counter tracking how many times the current loop has iterated. With those simple coordinates, a programmer can verify whether the program's variables satisfy the required logical invariants at any step. The unbridled 'go to' statement destroys this correspondence completely. When execution can leap arbitrarily from anywhere in the code to any labeled line, the mere fact that the processor has reached line 100 tells us nothing about how it got there or what values the variables currently hold, turning program verification into an intractable maze.",
    },

    // --- PHYSICS ---
    SeedPassage {
        id: "seed_phys_einstein1905",
        title: "The Principle of Relativity and the Velocity of Light",
        domain: "physics",
        source_attribution: "Albert Einstein, 'On the Electrodynamics of Moving Bodies' (Annalen der Physik, 1905)",
        passage_text: "It is well known that Maxwell's electrodynamics—as usually interpreted at the present time—when applied to moving bodies, leads to theoretical asymmetries that do not appear to exist in actual physical phenomena. Take, for example, the reciprocal electromagnetic interaction between a magnet and a wire conductor. The observable physical phenomenon depends solely on the relative motion of the conductor and the magnet, whereas the customary theory draws a sharp distinction between the two cases depending on which body is considered to be 'in motion' and which is considered 'at rest.'\n\nFor if the magnet is in motion and the conductor is held at rest, classical theory states that an electric field with a definite energy arises in the neighborhood of the magnet, generating an electric current inside the wire. But if the magnet is held stationary and the conductor is moved at the exact same relative speed, classical theory says no electric field arises around the magnet; instead, an electromotive force is induced directly within the moving conductor. Yet in both experiments, a meter attached to the wire measures an electric current of the exact same magnitude and behavior.\n\nExamples of this sort, together with our complete failure to detect any motion of the Earth relative to a hypothetical 'light-medium' or stationary ether, suggest that the phenomena of electrodynamics as well as of mechanics possess no properties corresponding to the idea of absolute rest. Rather, the same laws of electrodynamics and optics hold true for all inertial frames of reference in which the equations of mechanics are valid. We shall raise this conjecture—which we will call the Principle of Relativity—to the status of a fundamental postulate, and introduce alongside it a second postulate that is only apparently irreconcilable with the first: that light is always propagated in empty space with a definite velocity c which is independent of the state of motion of the emitting body. From these two simple postulates, a consistent and symmetric electrodynamics of moving bodies emerges without any need for a stationary ether.",
    },
    SeedPassage {
        id: "seed_phys_feynman1963",
        title: "Atoms in Motion: The Atomic Hypothesis",
        domain: "physics",
        source_attribution: "Richard Feynman, 'The Feynman Lectures on Physics' (Volume 1, Chapter 1, 1963)",
        passage_text: "If, in some cataclysm, all of scientific knowledge were to be destroyed, and only one sentence passed on to the next generation of creatures, what statement would contain the most information in the fewest words? I believe it is the atomic hypothesis: that all things are made of atoms—little particles that move around in perpetual motion, attracting each other when they are a little distance apart, but repelling upon being squeezed into one another. In that one sentence, you will see, there is an enormous amount of information about the world, if just a little imagination and thinking are applied.\n\nTo illustrate the power of the atomic idea, suppose that we have a drop of water a quarter of an inch on a side. If we look at it with the naked eye, or even through the finest optical microscope, we see nothing but smooth, continuous water. Yet if we magnify that drop two billion times, until it is as large as the entire Earth, we see a teeming swarm of jiggling water molecules, each composed of one oxygen atom and two hydrogen atoms, packed closely together and vibrating in ceaseless motion.\n\nThis constant jiggling is what we call heat: when we increase the temperature, the molecules vibrate and collide more violently, pushing each other slightly farther apart so the water expands. Because the molecules attract one another at short range, they stay clustered together as a liquid droplet rather than flying apart. However, if we heat the water enough, the thermal agitation overcomes the attractive force entirely; the molecules break free from their neighbors and fly through space on their own, colliding only occasionally with the walls of their container as steam, whose bombardment we measure as gas pressure. Conversely, if we cool the water, the molecular jiggling slows down until the attractive forces lock the molecules into a rigid, repeating geometric pattern with open hexagonal spaces between them—which is why water expands when it freezes into solid ice.",
    },
    SeedPassage {
        id: "seed_phys_newton1687",
        title: "The Axioms and Laws of Motion",
        domain: "physics",
        source_attribution: "Isaac Newton, 'Philosophiae Naturalis Principia Mathematica' (1687)",
        passage_text: "Rational mechanics rests upon three universal axioms, or Laws of Motion, that govern the movement of all matter on Earth and across the heavens. The First Law states that every body continues in its state of rest, or of uniform motion in a straight line, unless it is compelled to change that state by external forces impressed upon it. Before this principle of inertia was understood, philosophers assumed that a moving object naturally slows down on its own and requires a continuous push just to keep moving. In reality, a thrown stone or cannonball would travel forward in a straight line forever at constant speed were it not slowed by the resistance of the air and pulled downward by the force of gravity. Even the planets, whose paths are continually bent into orbits around the Sun, persist relentlessly in their forward motion through the vacuum of space.\n\nThe Second Law establishes how forces alter motion: the change of momentum of a body is directly proportional to the motive force impressed, and takes place along the straight line in which that force acts. If a given force produces a certain acceleration, a double force will produce double the acceleration, and a triple force triple the acceleration, whether applied all at once in a sharp impact or accumulated gradually over time. Because a body's momentum depends on both its mass and its velocity, the same force will accelerate a light pebble rapidly while shifting a heavy boulder only slightly.\n\nThe Third Law states that to every action there is always opposed an equal and opposite reaction; in other words, the mutual actions of two bodies upon each other are always equal and directed to contrary parts. Force is never a one-sided event, but a symmetric interaction between two objects. If you press a stone with your finger, your finger is pressed backward with the exact same force by the stone. If a horse draws a stone tied to a rope, the horse is simultaneously pulled backward toward the stone by the tension in the rope; the rope stretches equally at both ends, impeding the forward progress of the horse by the exact measure that it promotes the forward motion of the stone.",
    },

    // --- BIOLOGY ---
    SeedPassage {
        id: "seed_bio_darwin1859",
        title: "Natural Selection and the Struggle for Existence",
        domain: "biology",
        source_attribution: "Charles Darwin, 'On the Origin of Species' (Chapters 3 & 4, 1859)",
        passage_text: "Nothing is easier than to admit in the abstract the truth of the universal struggle for life, or more difficult—at least I have found it so—than constantly to bear this conclusion in mind. Yet unless it be thoroughly ingrained in the mind, the whole economy of nature, with every fact on geographical distribution, rarity, abundance, extinction, and variation, will be dimly seen or quite misunderstood. We behold the face of nature bright with gladness, and we often see a seasonal abundance of food; we forget that the birds singing idly around us live mostly on insects or seeds, and are thus constantly destroying life, while their own eggs and nestlings are heavily preyed upon in turn.\n\nI use the term 'Struggle for Existence' in a broad and metaphorical sense, encompassing not only direct competition between individuals, but also the dependence of one organism upon another, its battle against physical climate, and above all its success in leaving living offspring. Two canine predators in a time of famine may truly be said to struggle with each other for scarce prey. Follow that principle further: a plant on the edge of a desert is said to struggle for life against the drought, though more properly it is dependent on moisture for survival. Every species produces far more offspring—at a geometric rate of increase—than can possibly survive given finite space, water, and nourishment.\n\nBecause so many more individuals are born than can possibly survive, a recurring struggle for existence is inevitable. Consider then what happens when organisms within a species vary slightly from one another in structure, habits, or constitution. Can we doubt that individuals possessing any heritable variation, however slight, that gives them an advantage over others in obtaining food, escaping predators, or enduring drought will have the best chance of surviving and reproducing? Conversely, any injurious variation will lead to the destruction of its bearer. This preservation of favorable individual differences and variations, and the elimination of those that are harmful, I have called Natural Selection.",
    },
    SeedPassage {
        id: "seed_bio_watsoncrick1953",
        title: "Molecular Structure of Nucleic Acids",
        domain: "biology",
        source_attribution: "J. D. Watson and F. H. C. Crick, 'Molecular Structure of Nucleic Acids' (Nature 171, 1953)",
        passage_text: "We wish to suggest a structure for the salt of deoxyribose nucleic acid (DNA). This structure has novel features which are of considerable biological interest. A model for nucleic acid has recently been proposed by Pauling and Corey, consisting of three intertwined chains with the sugar-phosphate backbones near the central axis and the nitrogenous bases pointing outward. In our opinion, their three-chain structure is unsatisfactory on two grounds: first, X-ray diffraction diagrams are produced by the salt of DNA rather than the free acid, meaning there are no acidic hydrogen atoms to hold the negatively charged phosphate groups together at the center; second, at such tight distances the crowded atoms at the core would strongly repel one another.\n\nWe wish to put forward a radically different structure for DNA. Our model consists of two helical chains each coiled around the same central axis, running in opposite directions. Both chains follow right-handed helices, with the sugar and phosphate groups forming two regular outer backbones exposed to surrounding water, while the flat nitrogenous bases are stacked neatly on the inside of the helix perpendicular to the central axis, much like the steps of a spiral staircase.\n\nThe novel feature of the structure is the specific manner in which the two chains are held together by hydrogen bonds between their purine and pyrimidine bases. Because of strict geometric and chemical constraints inside the helix, a larger purine base on one chain must always pair with a smaller pyrimidine base on the opposite chain. Specifically, adenine can pair only with thymine, and guanine can pair only with cytosine. While the sequence of bases along a single chain is completely free to vary—allowing DNA to store vast biological information—once the sequence of bases on one chain is fixed, the sequence on the partner chain is automatically determined as its exact complement. It has not escaped our notice that the specific base pairing we have postulated immediately suggests a copying mechanism for the genetic material: if the two chains unwind and separate, each single strand can serve as a direct template for assembling a new complementary partner.",
    },
    SeedPassage {
        id: "seed_bio_carson1962",
        title: "The Obligation to Endure and Environmental Balance",
        domain: "biology",
        source_attribution: "Rachel Carson, 'Silent Spring' (Chapter 2, 1962)",
        passage_text: "The history of life on Earth has been a history of interaction between living things and their surroundings. To a large extent, the physical form and the habits of the Earth's vegetation and its animal life have been molded by the environment. Considering the whole span of earthly time, the opposite effect, in which life actually modifies its surroundings, has been relatively slight. Only within the moment of time represented by the present century has one species—humanity—acquired significant power to alter the fundamental nature of its world.\n\nDuring the past few decades, this power has not only increased to a disturbing magnitude, but it has also changed in character. The most alarming of all human assaults upon the environment is the widespread contamination of air, soil, rivers, and seas with dangerous and even lethal synthetic materials. This chemical pollution is for the most part irrecoverable; the chain of ecological disruption it initiates—not only in the physical environment that must support life, but inside living tissues themselves—is largely irreversible. In this universal contamination of the environment, synthetic chemicals have become the little-recognized partners of nuclear radiation in altering the very nature of organic life.\n\nTo understand why this poses an unprecedented crisis, we must consider the scale of evolutionary time. It took hundreds of millions of years to produce the life that now inhabits the Earth—eons of time in which developing, evolving, and diversifying life reached a state of adjustment and balance with its natural surroundings. When natural rocks eroded and released trace minerals or background radiation into water and soil, organisms had geological ages to adapt their biochemistry. Today, by contrast, synthetic chlorinated hydrocarbons and organic phosphates are invented in laboratories and broadcast across croplands and forests at a rate of hundreds of new compounds every year. These chemicals do not merely kill a single target insect; they persist in the soil, wash into watersheds, and concentrate exponentially as they move up the food chain from insects to songbirds, fish, and humans—operating at the furious pace of industrial production rather than the deliberate pace of biological adaptation.",
    },

    // --- CHEMISTRY ---
    SeedPassage {
        id: "seed_chem_mendeleev1889",
        title: "The Periodic Law of the Chemical Elements",
        domain: "chemistry",
        source_attribution: "Dmitri Mendeleev, Faraday Lecture (Royal Institution, London, 1889)",
        passage_text: "Before the discovery of the Periodic Law, chemical elements were studied largely as isolated facts or grouped only into small local clusters, with no overarching mathematical principle connecting them all. Scientists knew the relative atomic weights of dozens of elements and observed that certain groups—such as the reactive alkali metals lithium, sodium, and potassium, or the halogens chlorine, bromine, and iodine—shared striking family resemblances. Yet no one could say whether the total number of elements was limited, or predict whether unimagined substances lay hidden between known ones.\n\nThe Periodic Law demonstrated that the chemical elements are not a random assortment of matter, but possess a regular periodicity of properties as their atomic weights increase. When all known elements are arranged in sequential order according to the magnitude of their atomic weights, a striking recurrence of physical and chemical properties appears after definite intervals—much as musical notes repeat their harmonic character across octaves. Elements that fall into the same vertical column form natural families: they form oxides and hydrides in identical ratios, exhibit graduations in melting point and density, and react in predictable ways.\n\nIt was therefore possible not only to classify all existing elements into a unified system, but also to test the law by foretelling the existence and properties of elements not yet discovered. When I drafted my table of the elements in 1869, I refused to force known elements into columns where their chemical behavior did not belong; instead, I left vacant spaces where an element appeared to be missing from nature's sequence. Based on the surrounding neighbors in the table, I ventured to predict the existence, the atomic weights, the densities, and the chemical formulas of three unknown elements, which I provisionally named eka-boron, eka-aluminium, and eka-silicon. Within less than twenty years, the independent discoveries of gallium by Lecoq de Boisbaudran, scandium by Nilson, and germanium by Winkler—each possessing almost to the decimal point the exact physical and chemical properties calculated beforehand—furnished the most decisive verification that the Periodic Law reflects a deep structural truth of nature.",
    },
    SeedPassage {
        id: "seed_chem_lavoisier1789",
        title: "The Conservation of Matter in Chemical Operations",
        domain: "chemistry",
        source_attribution: "Antoine Lavoisier, 'Elements of Chemistry' (Traité Élémentaire de Chimie, 1789)",
        passage_text: "We may lay it down as an incontestable axiom that, in all the operations of art and nature, nothing is created and nothing is destroyed; an equal quantity of matter exists both before and after every experiment, the quality and quantity of the chemical elements remain precisely the same, and nothing takes place beyond changes and modifications in the combination of these elements. Upon this single principle—the conservation of mass—the entire art of performing accurate chemical experiments depends: we must always recognize an exact equality between the total mass of the elements in the starting substances and the total mass of the products obtained by their reaction.\n\nFor centuries, chemists had been misled because they neglected to trap and weigh the invisible gases absorbed from or released into the air during reactions. When wood burned to a light pile of ash, matter appeared to vanish; when a metal was roasted in air to form a powdery calx, its weight mysteriously increased. By performing reactions inside sealed glass vessels and weighing every solid, liquid, and gas on precision balances before and after each transformation, we proved that burning and rusting are simply the combination of a substance with oxygen gas from the air, with zero net gain or loss of total mass.\n\nConsider how this principle turns chemistry into an exact quantitative science. Since grape juice (known as must) ferments to yield carbon dioxide gas and alcohol, we can weigh the starting sugar, water, and yeast and verify that their combined mass equals the exact mass of the resulting alcohol, carbonic acid gas, and residual matter. Similarly, when we decompose water by passing steam through an incandescent iron tube, the oxygen in the water combines with the hot iron while the hydrogen is liberated as a flammable gas; at the end of the experiment, the weight gained by the oxidized iron plus the weight of the collected hydrogen gas equals, to the grain, the exact weight of the water that disappeared. Because matter is strictly conserved, every chemical reaction can be written as a balanced algebraic equation, allowing us to solve for any unknown substance.",
    },
    SeedPassage {
        id: "seed_chem_curie1904",
        title: "Radioactivity and the Concentration of Radium",
        domain: "chemistry",
        source_attribution: "Marie Curie, 'Radioactive Substances' (Doctoral Thesis, Chemical News, 1904)",
        passage_text: "Shortly after Henri Becquerel discovered that uranium salts spontaneously emit penetrating rays capable of fogging photographic plates and making air conduct electricity, I undertook a systematic quantitative measurement of this phenomenon—which I termed 'radioactivity'—using a sensitive piezoelectric electrometer. My measurements quickly revealed a fundamental physical truth: the intensity of radiation emitted by any uranium compound depends solely on the quantity of uranium atoms present, and is completely unaffected by the element's chemical combination, temperature, or exposure to light. Radioactivity was therefore not an ordinary chemical reaction between molecules, but an intrinsic property originating deep within the atom itself.\n\nThis insight led to an astonishing puzzle when I tested natural mineral ores. Pitchblende, a dark oxide mineral from which uranium is mined, proved to be nearly four times more radioactive than pure metallic uranium itself. If radioactivity is strictly proportional to the number of active atoms present, how could a raw mineral ore be far more active than the pure element it contained? The only logical deduction was that pitchblende must contain small quantities of some unknown chemical element far more radioactive than uranium.\n\nPierre Curie and I immediately set out to isolate this hidden substance from tons of pitchblende residue using standard methods of chemical separation, except that instead of relying on visible precipitates, we used our electrometer to track which chemical fraction carried the intense radioactivity. We discovered that pitchblende contained two distinct new radioactive elements: the first, which precipitated alongside bismuth, we named polonium in honor of my native Poland; the second, which shared nearly all the chemical behaviors of barium, we named radium. Because radium and barium are chemically so alike, separating them required a painstaking process of thousands of fractional crystallizations of their chloride salts, taking advantage of the fact that radium chloride is slightly less soluble in water and alcohol than barium chloride. At last, from several tons of ore, we isolated a decigram of pure radium chloride—a substance possessing a radioactivity more than a million times greater than uranium and displaying a unique atomic spectrum never before seen.",
    },

    // --- GENERAL HUMANITIES ---
    SeedPassage {
        id: "seed_hum_aurelius170",
        title: "The Inner Citadel and the Transient Nature of Things",
        domain: "general_humanities",
        source_attribution: "Marcus Aurelius, 'Meditations' (Book IV, c. 170 AD)",
        passage_text: "People continually look for retreats for themselves—in the quiet countryside, by the sea coast, or high in the hills—and you too are often prone to long for such an escape from daily pressures. Yet that longing misses a central philosophical truth: you have the power, at any hour you choose, to retreat into yourself. Nowhere can a person find a quieter or more untroubled refuge than within their own mind, especially when they have cultivated inner principles that need only be contemplated to restore immediate tranquility. And by tranquility I mean nothing arcane—simply the good order of a mind free from unnecessary turmoil.\n\nConstantly, then, grant yourself this brief inward retreat and renew your perspective. Keep your guiding principles short and foundational, so that encountering them immediately clears away resentment and sends you back without irritation to the civic duties and relationships to which you must return. Ask yourself what it is that actually disturbs you. Is it human wickedness or impatience? Recall that rational beings are made for cooperation, that people often act wrongly out of ignorance rather than malice, and that in a very short while both you and those who frustrate you will be gone.\n\nAbove all, remember this core distinction: external events and objects stand quietly outside the mind; they have no way of entering the soul or generating distress on their own. All inner turmoil comes solely from our own internal judgment about those events. When you strip away your fearful opinion—the complaint that 'I have been harmed'—the harm itself vanishes. At the same time, keep before your eyes the ceaseless flow of the universe: everything you see is in the process of changing and will soon give way to something else. Think continually of how many grand empires, fierce disputes, and anxious ambitions have already risen and vanished into silence. Our life is what our thoughts make of it; when we anchor our attention in rational judgment and purposeful action rather than in things outside our control, we remain steady in the midst of any storm.",
    },
    SeedPassage {
        id: "seed_hum_smith1776",
        title: "The Division of Labor and Productive Power",
        domain: "general_humanities",
        source_attribution: "Adam Smith, 'The Wealth of Nations' (Book I, Chapter 1, 1776)",
        passage_text: "The greatest improvement in the productive powers of labor, and the greater part of the skill, dexterity, and judgment with which it is anywhere directed or applied, seem to have been the effects of the division of labor. The effects of this principle in the general business of society are easiest to grasp by examining how it operates in a single, concrete manufacture. Consider the trade of the pin-maker—a seemingly trivial craft, yet one in which the division of labor produces an astonishing multiplication of output.\n\nA solitary workman not educated to this specific business, nor acquainted with the use of the specialized machinery employed in it, could scarce, perhaps, with his utmost industry, make one complete pin in a day, and certainly could not make twenty. But in the way in which this business is now carried on, not only is the whole work a peculiar trade, it is divided into a number of distinct branches, most of which are separate trades in themselves. One worker draws out the wire, another straightens it, a third cuts it, a fourth points it, and a fifth grinds it at the top to receive the head; making the pinhead alone requires two or three distinct operations; putting it on is a separate task, whitening the pins is another, and it is even a trade by itself to press them neatly into paper. I have seen a small manufactory of this kind where only ten men were employed, yet by dividing and coordinating some eighteen distinct operations among themselves, those ten workers produced upward of forty-eight thousand pins in a single day—more than four thousand eight hundred pins per person.\n\nThis vast increase in the quantity of work that the same number of people can perform is owing to three distinct circumstances. First, the increase of dexterity in every particular workman; by reducing a person's work to one simple operation and making it the primary practice of their trade, repetition builds extraordinary speed and precision. Second, the saving of time which is commonly lost in passing from one species of work to another, since a worker switching between different tools and workbenches inevitably loses focus and momentum at every transition. Third, the invention of a great number of machines which facilitate and abridge labor, often discovered when workers and engineers concentrate their whole attention on simplifying a single, well-defined step.",
    },
    SeedPassage {
        id: "seed_hum_mill1859",
        title: "Liberty of Thought and the Tyranny of the Majority",
        domain: "general_humanities",
        source_attribution: "John Stuart Mill, 'On Liberty' (Chapter 2, 1859)",
        passage_text: "If all mankind minus one were of one opinion, and only one person were of the contrary opinion, mankind would be no more justified in silencing that one person than he, if he had the power, would be justified in silencing mankind. Were an opinion merely a private possession of no value except to its owner—if being obstructed in expressing it were simply a personal inconvenience—it would make some difference whether the injury was inflicted on a few people or on many. But the peculiar evil of silencing the expression of an opinion is that it robs the entire human race: posterity as well as the existing generation, and those who dissent from the opinion even more than those who hold it.\n\nTo see why, we must consider three distinct possibilities regarding any opinion that society attempts to suppress. First, the opinion we seek to silence may in fact be true. Those who desire to suppress it will of course deny its truth, warning that society should not permit the spread of dangerous error; yet they are not infallible. Every age has held beliefs with absolute certainty that subsequent ages proved to be not only false, but absurd. To refuse to hear an opinion because we are already sure that it is false is to assume that our own personal certainty is the same thing as absolute certainty. All silencing of discussion is an assumption of infallibility.\n\nSecond, suppose the silenced opinion is indeed an error, while the prevailing opinion is the whole truth. Even then, humanity suffers a profound loss: if a true belief is not fully, frequently, and fearlessly debated against opposing arguments, it comes to be held as a dead dogma rather than a living truth. People who inherit a correct conclusion without ever having to defend its grounds or confront strong counterarguments soon forget the real reasons behind the doctrine; the words remain as a hollow shell of rote prejudice, incapable of guiding real conviction.\n\nFinally, the most common case in human affairs is that conflicting doctrines are neither wholly true nor wholly false, but instead share the truth between them. One side sees one facet of a complex problem clearly while overlooking another; only through the open collision of partial opinions can the missing remainder of the truth be supplied.",
    },
    // --- 10 ADDITIONAL CURATED READINGS ---
    SeedPassage {
        id: "seed_cs_lovelace1843",
        title: "Beyond Calculation: The General-Purpose Engine",
        domain: "computer_science",
        source_attribution: "Ada Lovelace, 'Notes on Sketch of the Analytical Engine' (1843)",
        passage_text: "Many persons who are not conversant with mathematical studies imagine that because the business of Charles Babbage's Analytical Engine is to give its results in numerical notation, the nature of its processes must consequently be purely arithmetical and numerical, rather than algebraic and analytical. This is an error. The engine can arrange and combine its numerical quantities exactly as if they were letters or any other general symbols; in fact, it might bring out its results in algebraic notation, were provisions made accordingly.\n\nThe bounds of arithmetic were stepped over the moment the idea of applying punched operation cards occurred, and the Analytical Engine does not occupy common ground with mere 'calculating machines.' It holds a position wholly its own, because the cards enable it to repeat and vary any sequence of operations depending on the outcomes of previous steps. In enabling a mechanism to combine together general symbols in successions of unlimited variety and extent, a uniting link is established between the operations of matter and the abstract mental processes of the most general branch of mathematical science.\n\nWe may say most aptly that the Analytical Engine weaves algebraic patterns just as the Jacquard loom weaves flowers and leaves. Again, it might act upon other things besides number, were objects found whose mutual fundamental relations could be expressed by those of the abstract science of operations, and which should be also susceptible of adaptations to the action of the operating notation and mechanism of the engine. Supposing, for instance, that the fundamental relations of pitched sounds in the science of harmony and of musical composition were susceptible of such expression and adaptations, the engine might compose elaborate and scientific pieces of music of any degree of complexity or extent. At the same time, we must guard against exaggerated ideas that the machine originates anything of its own: the Analytical Engine has no pretensions whatever to originate anything. It can do whatever we know how to order it to perform; its province is to assist us in making available what we are already acquainted with.",
    },
    SeedPassage {
        id: "seed_cs_vonneumann1945",
        title: "The Stored-Program Architecture",
        domain: "computer_science",
        source_attribution: "John von Neumann, 'First Draft of a Report on the EDVAC' (1945)",
        passage_text: "An automatic computing system is a device which can carry out instructions to perform calculations of a considerable order of complexity—for example, to solve non-linear partial differential equations in two or three independent variables numerically. Because these computations require millions of elementary steps in sequence, the device must operate at electronic speeds and cannot rely on human intervention between individual operations. The logical design of such a high-speed digital system requires dividing the machine into five functional subdivisions: a central arithmetic part, a central control part, a memory organ, an input organ, and an output organ.\n\nIn earlier computing machines, the numbers being processed were kept in one fast storage medium, while the instructions governing the sequence of operations were fed externally from paper tape or wired plugboards. That separation created a severe bottleneck: if the machine can perform thousands of arithmetic operations per second, waiting to read instructions from mechanical tape or requiring engineers to rewire cables for each new problem wastes the speed of the electronic circuits. Moreover, a truly general-purpose computation often needs to modify its own instructions dynamically—such as advancing the memory address of a vector element inside a loop.\n\nTo eliminate this bottleneck, both the numerical data of a problem and the coded instructions that direct the control unit must be stored together inside the very same high-speed, addressable memory organ. From the standpoint of the memory hardware, an instruction is simply a binary word indistinguishable from a number; the distinction exists only in how the central control unit interprets the word when it is fetched. By treating instructions and data uniformly in a single shared memory, a computer can switch from solving differential equations to sorting records in milliseconds simply by loading a new sequence of words into memory, establishing the universal stored-program architecture.",
    },
    SeedPassage {
        id: "seed_phys_galileo1638",
        title: "Falling Bodies and the Resistance of the Medium",
        domain: "physics",
        source_attribution: "Galileo Galilei, 'Dialogues Concerning Two New Sciences' (1638)",
        passage_text: "For nearly two thousand years, natural philosophers accepted Aristotle's rule that bodies of different weights fall through the same medium at speeds directly proportional to their weights—so that a stone ten times heavier than another would reach the ground ten times faster. Yet before we even appeal to physical experiment, a simple thought experiment reveals a contradiction at the heart of this claim. Imagine two stones, one heavy and one light, dropped from a high tower. According to the traditional rule, the heavy stone falls rapidly while the light stone falls slowly.\n\nNow suppose we tie the two stones together with a cord. What happens when they fall as a connected pair? On the one hand, the slower light stone should act as a brake on the faster heavy stone, retarding its fall so that the combined pair moves more slowly than the heavy stone alone. On the other hand, the two stones tied together form a single composite body whose total weight is greater than that of the heavy stone by itself, which by the very same rule means the combined pair must fall faster than the heavy stone alone. Because a single connected body cannot simultaneously fall both faster and slower than its heavier part, the assumption that speed of fall is proportional to weight collapses under its own logic.\n\nWhen we test the matter by dropping a cannonball of one hundred pounds and a musket ball of half a pound from a height of two hundred cubits, the heavy ball does not outrun the light one by two hundredfold; they strike the ground with scarcely two finger-breadths between them. That tiny difference is caused not by gravity pulling harder on the faster body's speed, but by the resistance of the air, which pushes back against the surface of a falling object and slows a light, low-density body—like a feather or a leaf—much more noticeably than a dense lead sphere. If the air were removed entirely so that both fell through a true vacuum, a lock of wool and a bit of lead would descend at the exact same rate of acceleration.",
    },
    SeedPassage {
        id: "seed_phys_faraday1831",
        title: "Electromagnetic Induction and Lines of Force",
        domain: "physics",
        source_attribution: "Michael Faraday, 'Experimental Researches in Electricity' (Royal Society, 1831)",
        passage_text: "Ever since Hans Christian Oersted demonstrated in 1820 that an electric current flowing through a wire deflects a nearby magnetic compass needle, scientists across Europe searched for the converse effect: if electricity can produce magnetism, why should magnetism not produce electricity? For ten years, experimenters placed powerful bar magnets next to coils of copper wire and connected sensitive galvanometers to the circuit, hoping to see a steady electric current flow. Every such attempt failed completely; a stationary magnet, no matter how strong, produced not the slightest trace of current.\n\nThe secret emerged when I wound two separate coils of insulated copper wire around opposite sides of the same iron ring. One coil was connected to a battery, and the second coil was connected to a galvanometer needle several feet away, with no direct electrical connection between the two wires. The instant I closed the switch to send current from the battery into the first coil, the galvanometer needle on the second coil jumped sharply to one side—and then, to my surprise, immediately settled back to zero even though the battery remained connected and the iron ring remained strongly magnetized. When I opened the switch to break the battery circuit, the needle jumped again, this time in the exact opposite direction, before returning once more to rest.\n\nThis transient pulse revealed the fundamental law of electromagnetic induction: an electric current is induced in a conductor not by a steady magnetic field, but only when the magnetic field is changing. Plunging a bar magnet into a hollow coil of wire drives a current in one direction; holding it still inside the coil produces nothing; pulling it out drives a current in the reverse direction. To visualize why motion is required, we can picture the space around a magnet as filled with invisible magnetic lines of force curving from pole to pole: a voltage arises in a wire whenever the wire cuts across those lines of force, converting mechanical motion directly into electrical energy.",
    },
    SeedPassage {
        id: "seed_bio_mendel1866",
        title: "Discrete Inheritance and Hidden Traits",
        domain: "biology",
        source_attribution: "Gregor Mendel, 'Experiments on Plant Hybridization' (1866)",
        passage_text: "Anyone who observes the striking regularity with which the same hybrid forms reappear whenever two distinct species of plants are fertilized cannot fail to suspect that a definite law governs the transmission of hereditary traits. Previously, most naturalists assumed that heredity worked like mixing two colors of paint: if a tall plant were crossed with a dwarf plant, or a red flower with a white one, the offspring's traits should blend permanently into an intermediate form, gradually washing out individual variations over generations. Yet no previous experiment had been carried out on a large enough scale, tracking individual traits across multiple generations with strict numerical counts, to test whether traits truly blend or remain distinct.\n\nTo investigate this question clearly, I selected the common garden pea, which self-pollinates cleanly and offers pairs of sharply contrasting traits—such as round versus wrinkled seeds, yellow versus green seed albumen, and tall six-foot stems versus short one-foot stems. When I crossed pure-breeding tall plants with pure-breeding dwarf plants, the first hybrid generation did not grow to a medium height of three feet; instead, every single hybrid plant was just as tall as the tall parent, as though the dwarf character had vanished altogether. I termed the trait that appears unchanged in the first generation 'dominant,' and the trait that becomes latent or hidden 'recessive.'\n\nThe decisive revelation came when these tall hybrid plants were allowed to self-fertilize to produce a second generation. Out of 1,064 plants raised from their seeds, 787 grew tall and 277 grew dwarf—an exact ratio of three to one. The dwarf trait had not been diluted, altered, or destroyed while hidden inside the first generation; it re-emerged completely pure. This proved that hereditary traits are not continuous fluids that blend irreversibly, but discrete particulate units inherited in pairs—one from each parent—that segregate cleanly when reproductive cells are formed.",
    },
    SeedPassage {
        id: "seed_bio_pasteur1861",
        title: "The Swan-Neck Flask and the Germ Theory of Life",
        domain: "biology",
        source_attribution: "Louis Pasteur, 'On the Organized Bodies Which Exist in the Atmosphere' (1861)",
        passage_text: "For centuries, scholars and physicians debated the doctrine of spontaneous generation: the belief that microscopic living organisms—bacteria, molds, and yeasts—arise spontaneously out of non-living organic matter whenever broth, milk, or wine is left exposed to the air. Proponents of spontaneous generation pointed to a familiar observation: if you boil a nutrient broth in a glass flask to kill every living thing inside and then leave the flask open to the atmosphere, within forty-eight hours the clear liquid turns cloudy and teems with millions of active microbes. Even when experimenters sealed the flasks, critics objected that heating or sealing the vessel had damaged the 'vital vegetative force' of the fresh air required to spark new life.\n\nTo settle this controversy beyond doubt, I needed an experiment that allowed fresh, unheated atmospheric air to flow freely into the boiled broth while preventing the invisible solid dust particles suspended in the air from falling into the liquid. I poured sugared yeast water into glass flasks and then heated the glass necks in a flame, drawing them out into long, narrow, S-shaped curves resembling the neck of a swan. The ends of the curved necks were left completely open to the room.\n\nI then boiled the broth inside each flask until steam rushed out of the open tip, sterilization being complete, and allowed the flasks to cool slowly. As the flasks cooled, ordinary outside air was drawn back in through the open neck, completely unheated and unaltered in its chemical composition. Yet because the neck curved sharply downward and then upward again, heavy dust particles and the microscopic spores riding upon them settled by gravity onto the moist lower bend of the glass tube and could not climb up into the liquid chamber. Months and even years passed, and the broth inside the open swan-neck flasks remained crystal clear and completely sterile. The moment I snapped the curved neck off a flask—or simply tilted the flask so the broth touched the dust trapped in the bend—the liquid clouded with teeming microbes within two days, proving that life comes only from preexisting life.",
    },
    SeedPassage {
        id: "seed_chem_boyle1661",
        title: "From Alchemical Essences to Chemical Elements",
        domain: "chemistry",
        source_attribution: "Robert Boyle, 'The Sceptical Chymist' (1661)",
        passage_text: "For many ages, two rival schools dominated natural philosophy regarding the composition of matter. Followers of Aristotle maintained that every terrestrial body is compounded out of just four elements—Earth, Air, Fire, and Water—while the alchemists or 'Spagyrists' insisted that all bodies consist of three mystical principles: Salt, Sulfur, and Mercury. Both schools relied on the same favorite demonstration: when a piece of green wood is burned in a hearth, a flame blazes forth (Fire), smoke vanishes into the chimney (Air), sap hisses and boils at the ends of the log (Water), and a pile of ash remains behind (Earth).\n\nYet a skeptical examination shows that this demonstration proves no such thing. Fire does not merely separate preexisting elements that were sitting unchanged inside the wood; rather, intense heat tears apart and rearranges the minute particles of a complex substance into entirely new chemical combinations that vary depending on how the heat is applied. If you burn wood in an open flame, you obtain soot and ash; if you heat the exact same wood inside a closed distillation vessel excluded from air, you obtain oil, vinegar, spirit, charcoal, and gas—five distinct products, none of which is a truly simple, uncompounded element. Worse still, gold and silver can be held in the fiercest furnace fire for weeks without yielding a single drop of water, a grain of ash, or a wisp of sulfur.\n\nTo place chemistry on a sound experimental footing, we must abandon mystical numbers of principles decided in advance by philosophical tradition and adopt a clear, empirical definition of an element. I mean by Elements certain primitive and simple, or perfectly unmingled bodies; which not being made of any other bodies, or of one another, are the ingredients of which all those called perfectly mixt bodies are immediately compounded, and into which they are ultimately resolved. Whether a substance such as gold, sulfur, or water is truly an element cannot be settled by armchair argument, but only by laboratory analysis: a substance should be regarded as elementary only so long as no chemical operation has succeeded in decomposing it into simpler constituents.",
    },
    SeedPassage {
        id: "seed_chem_pauling1939",
        title: "Electron Sharing and Molecular Geometry",
        domain: "chemistry",
        source_attribution: "Linus Pauling, 'The Nature of the Chemical Bond' (1939)",
        passage_text: "During the nineteenth century, chemists learned to write structural formulas showing which atoms are connected to which inside a molecule, drawing a single dash between hydrogen and oxygen in water or four dashes around a carbon atom in methane. Yet those flat marks on paper could not answer the deeper physical question: what is the actual force that holds two neutral atoms together so tightly that it takes intense heat or electrical energy to pull them apart, and why do atoms bond only in specific three-dimensional angles?\n\nThe answer emerged from the marriage of quantum mechanics and atomic structure. Every atom consists of a dense, positively charged nucleus surrounded by shells of negatively charged electrons, and atoms reach their state of lowest energy and greatest stability when their outermost shell of electrons is completely filled, like that of the inert noble gases helium, neon, and argon. Atoms achieve this stable configuration in two principal ways. When a metal atom with a loosely held outer electron meets a nonmetal atom that lacks just one electron to fill its shell—such as sodium meeting chlorine—the electron transfers completely from sodium to chlorine, creating a positively charged sodium ion and a negatively charged chloride ion that lock together by electrostatic attraction into an ionic crystal of table salt.\n\nMore often, however, two atoms neither give up nor seize electrons outright; instead, they form a covalent bond by sharing a pair of electrons between them so that the shared pair counts toward filling the outer shell of both nuclei simultaneously. Because the wavefunctions of these outer electrons occupy directed three-dimensional orbitals in space, covalent bonds form at precise geometric angles: a carbon atom directs its four bonds toward the four corners of a regular tetrahedron at angles of 109.5 degrees, giving diamond its extraordinary hardness, while the bent angle of the two hydrogen-oxygen bonds in a water molecule creates a permanent electrical polarity that enables water to dissolve salts and form the hydrogen bonds essential to all living cells.",
    },
    SeedPassage {
        id: "seed_hum_plato375bc",
        title: "The Allegory of the Cave and the Ascent of Mind",
        domain: "general_humanities",
        source_attribution: "Plato, 'The Republic' (Book VII, c. 375 BC)",
        passage_text: "Imagine human beings living in an underground cavern, which has a mouth open toward the light and reaching all along the cave. Here they have been from their childhood, with their legs and necks chained so that they cannot move, able only to see directly in front of them because the chains prevent them from turning their heads around. Above and behind them a fire is blazing at a distance, and between the fire and the prisoners there is a raised walkway along which a low wall has been built, like the screen which marionette players have in front of them, over which they show the puppets.\n\nAlong this wall, people walk carrying vessels and figures of men and animals made of wood and stone, which project above the wall. The chained prisoners see nothing of themselves or of one another, nor of the objects being carried behind them, except the shadows cast by the fire upon the wall of the cave facing them. Having never seen anything else since birth, they naturally suppose that these flickering shadows are the only real things in the world, and they even award prizes and honors to whichever prisoner is sharpest at remembering the customary order in which the shadows pass.\n\nNow consider what would happen if one of the prisoners were released from his chains and compelled to stand up, turn his neck around, and walk with open eyes toward the firelight. The glare would dazzle and pain his eyes, and at first he would believe that the shadows he used to watch were truer and clearer than the solid objects now being shown to him. And if someone dragged him up the steep, rugged ascent out of the cavern into the full light of the sun, his eyes would be so overwhelmed by the brightness that he would have to accustom himself gradually—looking first at shadows, then at reflections in water, then at the stars by night, and finally at the sun itself as the source of all light and seasons. Education, therefore, is not what some professors claim it to be—putting sight into blind eyes as if pouring information into an empty vessel—but rather the art of turning the whole soul around from the shadows of unexamined habit toward the light of genuine understanding.",
    },
    SeedPassage {
        id: "seed_hum_douglass1845",
        title: "Literacy as the Pathway to Freedom",
        domain: "general_humanities",
        source_attribution: "Frederick Douglass, 'Narrative of the Life of Frederick Douglass' (Chapters 6 & 7, 1845)",
        passage_text: "Very soon after I went to live with Mr. and Mrs. Auld in Baltimore, she very kindly commenced to teach me the A, B, C. After I had learned this, she assisted me in learning to spell words of three or four letters. Just at this point of my progress, Mr. Auld found out what was going on, and at once forbade Mrs. Auld to instruct me further, telling her that it was unlawful, as well as unsafe, to teach a slave to read. 'If you give a nigger an inch,' said he, 'he will take an ell. A nigger should know nothing but to obey his master—to do as he is told to do. Learning would spoil the best nigger in the world. If you teach that nigger how to read, there would be no keeping him. It would forever unfit him to be a slave.'\n\nThese words sank deep into my heart, stirred up sentiments within that lay slumbering, and called into existence an entirely new train of thought. It was a new and special revelation, explaining dark and mysterious things with which my youthful understanding had struggled in vain. I now understood what had been to me a most perplexing difficulty—to wit, the white man's power to enslave the black man. From that moment, I understood the pathway from slavery to freedom. Whilst I was saddened by the thought of losing the aid of my kind mistress, I was gladdened by the invaluable instruction which, by the merest accident, I had gained from my master. Though conscious of the difficulty of learning without a teacher, I set out with high hope and a fixed purpose, at whatever cost of trouble, to learn how to read.\n\nThe plan which I adopted, and the one by which I was most successful, was that of making friends of all the little white boys whom I met in the street. As many of these as I could, I converted into teachers. With their kindly aid, obtained at different times and in different places, I finally succeeded in learning to read. When I was sent on errands, I always took my book with me, and by going one part of my errand quickly, I found time to get a lesson before my return, trading bread to hungry neighborhood children in exchange for that more valuable bread of knowledge.",
    },
];

/// Authentic multi-section public-domain source documents used by the non-generative AI curator.
/// The AI selects a document and section range (`start_section..=end_section`), and deterministic
/// Rust code extracts the exact verbatim paragraphs without generating prose.
pub struct ArchiveDocument {
    pub doc_id: &'static str,
    pub title: &'static str,
    pub domain: &'static str,
    pub difficulty: &'static str,
    pub source_attribution: &'static str,
    pub sections: &'static [&'static str],
}

pub const CURATED_SOURCE_ARCHIVE: &[ArchiveDocument] = &[
    // --- HUMANITIES ARCHIVE ---
    ArchiveDocument {
        doc_id: "archive_hum_thoreau1854",
        title: "Simplicity and Deliberate Living",
        domain: "general_humanities",
        difficulty: "Easy",
        source_attribution: "Henry David Thoreau, 'Walden' (Chapter 2: Where I Lived, and What I Lived For, 1854)",
        sections: &[
            "I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived. I did not wish to live what was not life, living is so dear; nor did I wish to practice resignation, unless it was quite necessary. I wanted to live deep and suck out all the marrow of life, to live so sturdily and Spartan-like as to put to rout all that was not life, to cut a broad swath and shave close, to drive life into a corner, and reduce it to its lowest terms.",
            "Still we live meanly, like ants; though the fable tells us that we were long ago changed into men; like pygmies we fight with cranes; it is error upon error, and clout upon clout, and our best virtue has for its occasion a superfluous and evitable wretchedness. Our life is frittered away by detail. An honest man has hardly need to count more than his ten fingers, or in extreme cases he may add his ten toes, and lump the rest. Simplicity, simplicity, simplicity! I say, let your affairs be as two or three, and not a hundred or a thousand; instead of a million count half a dozen, and keep your accounts on your thumb-nail.",
            "In the midst of this chopping sea of civilized life, such are the clouds and storms and quicksands and thousand-and-one items to be allowed for, that a man has to live, if he would not founder and go to the bottom and not make his port at all, by dead reckoning, and he must be a great calculator indeed who succeeds. Simplify, simplify. Instead of three meals a day, if it be necessary eat but one; instead of a hundred dishes, five; and reduce other things in proportion.",
            "Time is but the stream I go a-fishing in. I drink at it; but while I drink I see the sandy bottom and detect how shallow it is. Its thin current slides away, but eternity remains. I would drink deeper; fish in the sky, whose bottom is pebbly with stars. Every morning was a cheerful invitation to make my life of equal simplicity, and I may say innocence, with Nature herself.",
        ],
    },
    ArchiveDocument {
        doc_id: "archive_hum_aristotle340bc",
        title: "Habit, Virtue, and the Golden Mean",
        domain: "general_humanities",
        difficulty: "Medium",
        source_attribution: "Aristotle, 'Nicomachean Ethics' (Book II, c. 340 BC)",
        sections: &[
            "Virtue, then, being of two kinds, intellectual and moral, intellectual virtue in the main owes both its birth and its growth to teaching, for which reason it requires experience and time; while moral virtue comes about as a result of habit, whence also its name ethics is one that is formed by a slight variation from the word for custom. From this it is also plain that none of the moral virtues arises in us by nature; for nothing that exists by nature can form a habit contrary to its nature. For instance, the stone which by nature moves downwards cannot be habituated to move upwards, not even if one tries to train it by throwing it up ten thousand times.",
            "Neither by nature, then, nor contrary to nature do the virtues arise in us; rather we are adapted by nature to receive them, and are made perfect by habit. Again, of all the things that come to us by nature we first acquire the potentiality and later exhibit the activity, as is plain in the case of the senses; for it was not by often seeing or often hearing that we got these senses, but on the contrary we had them before we used them. The virtues, by contrast, we get by first exercising them, as also happens in the case of the arts and crafts. For the things we have to learn before we can do them, we learn by doing them: people become builders by building and lyre-players by playing the lyre; so too we become just by doing just acts, temperate by doing temperate acts, brave by doing brave acts.",
            "First, then, let us consider this: that it is the nature of such qualities to be destroyed by defect and by excess, just as we see happens in the case of bodily strength and health. Both excessive and defective exercise destroys the strength, and similarly drink or food which is above or below a certain amount destroys the health, while that which is proportionate both produces and increases and preserves it. So too is it in the case of temperance and courage and the other virtues. The person who flies from and fears everything and does not stand their ground against anything becomes a coward, and the person who fears nothing at all but goes to meet every danger becomes rash; courage, therefore, is preserved by the mean between these extremes.",
        ],
    },
    ArchiveDocument {
        doc_id: "archive_hum_tocqueville1835",
        title: "Civic Associations and Democratic Cooperation",
        domain: "general_humanities",
        difficulty: "Hard",
        source_attribution: "Alexis de Tocqueville, 'Democracy in America' (Volume II, Part 2, 1840)",
        sections: &[
            "Americans of all ages, all conditions, and all dispositions constantly form associations. They have not only commercial and manufacturing companies, in which all take part, but associations of a thousand other kinds—religious, moral, serious, futile, general or restricted, enormous or diminutive. The Americans make associations to give entertainments, to found seminaries, to build inns, to construct churches, to diffuse books, to send missionaries to the antipodes; in this manner they found hospitals, prisons, and schools. If it is proposed to inculcate some truth or to foster some feeling by the encouragement of a great example, they form a society.",
            "In aristocratic societies, a few wealthy and powerful nobles stood at the head of permanent followings; each lord could undertake great public enterprises almost single-handedly by commanding his dependents. In democratic nations, by contrast, all citizens are independent and individually weak; they can do hardly anything by themselves, and none of them can oblige their fellow citizens to lend their assistance. They would all therefore fall into complete helplessness if they did not learn the art of voluntarily helping one another.",
            "A government might perform the part of some of the largest American associations, and several individual states have already attempted to do so; what political power could ever carry on the vast multitude of lesser undertakings which the American citizens perform every day with the assistance of the principle of association? As soon as several of the inhabitants of the United States have taken up an opinion or a feeling which they wish to promote in the world, they look out for mutual assistance; and as soon as they have found one another out, they combine. From that moment they are no longer isolated individuals, but a visible power whose actions serve as an example and whose language is listened to across society.",
        ],
    },

    // --- BIOLOGY ARCHIVE ---
    ArchiveDocument {
        doc_id: "archive_bio_frisch1953",
        title: "How Honeybees Map Distance and Direction",
        domain: "biology",
        difficulty: "Easy",
        source_attribution: "Karl von Frisch, 'The Dancing Bees' (Chapters 7 & 8, 1953)",
        sections: &[
            "When a scout honeybee discovers a rich patch of clover or a dish of sugar water placed near the hive, she fills her honey stomach and flies straight back to the dark vertical comb inside the colony. Within minutes of her return, dozens of her hive-mates fly out and arrive at the exact same flower bed, even though the scout did not lead them there. How does a tiny insect inside a pitch-dark hive tell her companions where to find food in the outside world?",
            "By marking individual bees with tiny dots of colored paint and watching them through a glass-walled observation hive, I discovered that the returning scout communicates by performing two distinct dances on the honeycomb. If the food source is very close to the hive—within about fifty meters—she performs a simple 'round dance,' running in tight circles first to the right and then to the left. This excited circling tells the surrounding bees to fly out and search in all directions near the hive for the floral scent clinging to her body.",
            "If the food lies farther away—hundreds of meters or several kilometers from the hive—the scout switches to a remarkable 'waggle dance.' She runs forward in a straight line while rapidly waggling her abdomen from side to side, circles back to her starting point on the left, repeats the straight waggle run, and then circles back on the right. The tempo of the dance reveals the distance: the farther away the flowers are, the slower and longer each straight waggle run becomes.",
            "Even more astonishing is how she communicates direction inside the dark hive. The bee translates the angle of the sun in the sky into the angle of gravity on the vertical honeycomb: running straight upward during the waggle run means 'fly directly toward the sun,' running straight downward means 'fly directly away from the sun,' and running sixty degrees to the left of vertical means 'fly sixty degrees to the left of the sun's current position.'",
        ],
    },
    ArchiveDocument {
        doc_id: "archive_bio_harvey1628",
        title: "The Closed Circulation of the Blood",
        domain: "biology",
        difficulty: "Medium",
        source_attribution: "William Harvey, 'On the Motion of the Heart and Blood in Animals' (1628)",
        sections: &[
            "For more than a thousand years, physicians taught Galen's doctrine that the liver continually manufactures new blood out of digested food and sends it outward through the veins to be consumed completely by the tissues of the body, like irrigation water soaking into dry soil. According to that ancient view, the heart did not pump blood around a closed loop; instead, blood supposedly ebbed and flowed back and forth in the vessels like the tides, while invisible pores in the thick wall dividing the heart allowed blood to seep from the right side to the left.",
            "When I began to examine the living heart and calculate the actual quantity of blood expelled with every beat, I found this traditional belief impossible to reconcile with simple arithmetic. Suppose the left ventricle of the human heart holds just two ounces of blood and expels only half an ounce into the aorta with each contraction. Since the heart beats more than seventy times in a single minute, in half an hour it pumps over two thousand contractions—driving more than a thousand ounces, or over sixty pounds, of blood into the arteries.",
            "That quantity is vastly greater than the total amount of blood contained in the entire body, and far more than could possibly be produced from all the food and drink a person consumes in a week. Where could all this blood come from, and where could it go without bursting the arteries, unless it returns continually to the heart? Furthermore, the valves inside the veins are all pointed toward the heart, mechanically preventing venous blood from flowing backward toward the limbs. The blood must therefore move in a perpetual circle, driven outward from the heart through the arteries into every tissue and returning through the veins back to the heart.",
        ],
    },
    ArchiveDocument {
        doc_id: "archive_bio_humboldt1808",
        title: "The Web of Life Across Mountain Zones",
        domain: "biology",
        difficulty: "Hard",
        source_attribution: "Alexander von Humboldt, 'Essay on the Geography of Plants' & 'Views of Nature' (1808)",
        sections: &[
            "When a traveler ascends from the tropical sea-level coast of South America toward the snow-covered summit of Chimborazo in the Andes, they pass in a single day through the same succession of climates and plant forms that would require a journey of thousands of miles from the equator toward the poles. At the warm, humid base of the mountain flourish palms, banana trees, and dense tangles of orchids; higher up, where the air cools and mists gather, tropical forest gives way to oak woods and shrubby cinchona trees; higher still lie windswept alpine grasses, and finally, just below the line of perpetual ice, only hardy lichens cling to the bare volcanic rock.",
            "By measuring barometric pressure, air temperature, humidity, soil composition, and atmospheric blueness at every altitude along the slope, we discover that vegetation is not distributed arbitrarily across the globe, but is governed by interlocking physical laws. Each plant community occupies a distinct thermal and atmospheric zone, and in turn modifies the soil, retains moisture on the mountain slopes, and shapes the microclimate for the insects, birds, and mammals that depend upon it.",
            "In this great chain of causes and effects, no single fact of nature can be considered in isolation. If forests are stripped from the mountain heights, the fertile topsoil washes away during torrential rains, mountain springs dry up during the summer, and the climate of the valleys below becomes simultaneously more arid and more prone to violent floods. Nature is a unified living whole—a vast web of interconnected organisms and physical forces in which the disturbance of one link reverberates through the entire system.",
        ],
    },

    // --- PHYSICS ARCHIVE ---
    ArchiveDocument {
        doc_id: "archive_phys_huygens1690",
        title: "Waves of Light and Expanding Ripples",
        domain: "physics",
        difficulty: "Easy",
        source_attribution: "Christiaan Huygens, 'Treatise on Light' (Chapter 1, 1690)",
        sections: &[
            "When we look at a candle flame or a distant star, how does light travel across the space between the glowing object and our eye? There are only two ways in which motion can be communicated from one place to another in nature: either a physical particle shoots through space from the source to the eye, like an arrow shot from a bow, or a disturbance spreads outward wave by wave through an intervening medium, the way sound travels through the air or ripples spread across a quiet pond when a stone is dropped into the water.",
            "If light consisted of solid darts or particles flying from every point of a candle flame, two beams of light crossing each other through a narrow hole would inevitably collide and scatter one another in all directions. Yet experience shows that two people can look right through the same tiny pinhole at the same instant and see two different objects on the other side with perfect clarity, without either beam disturbing the other in the slightest. Just as two sets of water ripples on a pond pass right through one another and continue on their separate paths unchanged, light beams cross without collision because they are waves.",
            "To trace how a wave of light advances and bends when it enters glass or water, we can apply a simple geometric rule: every single point on an advancing wavefront acts as a new center of disturbance, sending out its own tiny spherical wavelet forward in time. The new position of the main wave at the next instant is simply the smooth outer envelope that touches all those tiny secondary wavelets at once, explaining both why light reflects at equal angles from a mirror and why it bends toward the perpendicular when slowing down inside water or glass.",
        ],
    },
    ArchiveDocument {
        doc_id: "archive_phys_rayleigh1871",
        title: "Why the Daytime Sky Is Blue and Sunsets Are Red",
        domain: "physics",
        difficulty: "Medium",
        source_attribution: "John William Strutt (Lord Rayleigh), 'On the Light from the Sky, Its Polarization and Colour' (Philosophical Magazine, 1871)",
        sections: &[
            "If the Earth had no atmosphere, the daytime sky would look pitch black even at noon, with the Sun blazing like a fierce searchlight among visible stars. Instead, we look up at a dome of clear blue light that illuminates even the shaded side of buildings. What is there in the clear air high above the clouds that catches the white light of the Sun and sends predominantly blue rays down to our eyes?",
            "White sunlight is a mixture of electromagnetic waves of different wavelengths, ranging from comparatively long red and orange waves to very short violet and blue waves. When a beam of sunlight enters the atmosphere, it encounters particles and gas molecules that are much smaller than the wavelength of visible light itself. Just as a small wooden post standing in a harbor barely disturbs long ocean swells that roll right past it, yet strongly splashes and scatters short, choppy ripples, tiny atmospheric molecules let long red light waves pass almost straight through while deflecting short blue waves in every direction.",
            "Mathematical analysis of wave scattering by particles small compared to the wavelength reveals an exact inverse fourth-power law: the intensity of scattered light varies inversely with the fourth power of the wavelength. Because blue light has a wavelength roughly half as long as deep red light, tiny particles in the air scatter blue light nearly ten to sixteen times more strongly than red light. When we look overhead away from the Sun, our eyes receive this scattered blue light bouncing down from all parts of the atmosphere; when we look directly at the Sun at sunset, its rays have traveled through a long horizontal path of air that has scattered away almost all the blue and violet, leaving the transmitted disk glowing orange and red.",
        ],
    },
    ArchiveDocument {
        doc_id: "archive_phys_maxwell1871",
        title: "Molecular Sorting and the Second Law of Thermodynamics",
        domain: "physics",
        difficulty: "Hard",
        source_attribution: "James Clerk Maxwell, 'Theory of Heat' (Chapter 22: Limitation of the Second Law, 1871)",
        sections: &[
            "One of the best-established generalizations of physical science is the Second Law of Thermodynamics, which states that it is impossible for heat to flow by itself from a colder body to a warmer body without the expenditure of external mechanical work. If a vessel of air is divided into two compartments A and B at the same uniform temperature, classical thermodynamics declares it impossible to make compartment A hotter and compartment B colder merely by passive internal arrangements.",
            "Yet the truth of the Second Law is a statistical truth rather than an absolute mechanical certainty for every individual molecule. In any gas at a given temperature, the molecules do not all move at the same uniform speed; because of continual random collisions, some molecules are moving much faster than average while others are moving much more slowly. What we measure with a thermometer as the 'temperature' of the gas is merely the average kinetic energy of trillions of molecules taken together.",
            "Now conceive a finite being who knows the paths and velocities of every individual molecule and who guards a frictionless microscopic trapdoor in the wall dividing compartment A from compartment B. Whenever this observant being sees a faster-than-average molecule approaching the door from B, they open the door to let it pass into A; whenever they see a slower-than-average molecule approaching from A, they let it pass into B. Without performing any mechanical work on the gas molecules, this sorting process would steadily raise the temperature of A and lower the temperature of B—showing that the Second Law of Thermodynamics arises from our statistical inability to track and manipulate individual molecules without expending information and energy.",
        ],
    },

    // --- CHEMISTRY ARCHIVE ---
    ArchiveDocument {
        doc_id: "archive_chem_faraday1861",
        title: "Capillary Action and the Anatomy of a Flame",
        domain: "chemistry",
        difficulty: "Easy",
        source_attribution: "Michael Faraday, 'The Chemical History of a Candle' (Lecture I, Royal Institution, 1861)",
        sections: &[
            "There is no better, there is no more open door by which you can enter into the study of natural philosophy than by considering the physical phenomena of a candle. Look first at a solid wax candle burning quietly in a room without a draft. You see that the heat of the flame melts the wax just around the base of the wick, forming a neat, level cup full of liquid fuel, while the outside rim of the candle stays cool enough to remain solid and hold the liquid pool without spilling.",
            "How does that melted wax get up from the cup into the flame, where it actually burns? It climbs upward through the tiny spaces between the braided cotton threads of the wick by capillary attraction—the very same force that draws water up into a lump of sugar or a sponge when only its bottom corner touches a wet saucer. Notice that the solid wax itself never burns, nor does the liquid wax in the cup; the fuel burns only after it has climbed the wick and been turned by intense heat into an invisible vapor.",
            "You can prove that the center of the flame is filled with unburned wax vapor by a simple experiment: if you blow out a candle sharply, you see a ribbon of white vapor rising from the hot wick, and if you hold a lighted match two inches above the wick in that stream of vapor, a flash of fire jumps right down through the vapor to relight the candle. A candle flame is actually a hollow luminous cone: on the outside, where oxygen from the air meets the hot vapor directly, combustion is complete and fiercest; in the middle layer, tiny particles of carbon are heated white-hot before they burn, giving the flame its warm yellow light.",
        ],
    },
    ArchiveDocument {
        doc_id: "archive_chem_dalton1808",
        title: "Atomic Weights and the Law of Multiple Proportions",
        domain: "chemistry",
        difficulty: "Medium",
        source_attribution: "John Dalton, 'A New System of Chemical Philosophy' (Part I, 1808)",
        sections: &[
            "Whether the ultimate particles of a pure substance, such as water or oxygen gas, are all exactly alike in figure and weight is a question of the highest importance in chemistry. Every drop of pure water, whether condensed from steam, melted from mountain snow, or formed by burning hydrogen in oxygen, exhibits identical physical and chemical properties. We may therefore conclude with confidence that the ultimate particles of any homogeneous substance are perfectly alike in weight, figure, and every other quality; otherwise, one sample of water would differ noticeably from another.",
            "Chemical analysis and synthesis go no further than to the separation of particles one from another, and to their reunion. No new creation or destruction of matter is within the reach of chemical agency. We might as well attempt to introduce a new planet into the solar system, or to annihilate one already in existence, as to create or destroy a single particle of hydrogen. All the changes we can produce consist in separating particles that are in a state of cohesion or combination, and joining those that were previously at a distance.",
            "When two elements combine to form more than one distinct compound—as carbon and oxygen do when they form both carbon monoxide and carbon dioxide—a remarkable numerical law appears. If we fix the weight of carbon at a constant amount, the weight of oxygen that combines with it in the second gas is an exact, simple whole-number multiple—precisely double—the weight of oxygen in the first gas. This Law of Multiple Proportions is inexplicable if matter were infinitely divisible like a continuous fluid, but follows immediately once we recognize that chemical combination is the union of discrete, indivisible atoms in simple ratios such as one-to-one or one-to-two.",
        ],
    },
    ArchiveDocument {
        doc_id: "archive_chem_arrhenius1887",
        title: "Ions in Solution and Electrical Conductivity",
        domain: "chemistry",
        difficulty: "Hard",
        source_attribution: "Svante Arrhenius, 'On the Dissociation of Substances Dissolved in Water' (Zeitschrift für Physikalische Chemie, 1887)",
        sections: &[
            "Pure distilled water is an extraordinarily poor conductor of electricity, and dry solid crystals of sodium chloride—ordinary table salt—likewise do not conduct an electric current at room temperature. Yet the moment a pinch of salt is dissolved in that pure water, the resulting liquid solution conducts electricity with remarkable ease. Previously, chemists assumed that dissolved salt molecules remained intact as neutral sodium-chlorine pairs floating in the water until an external electrical voltage was applied to tear them apart.",
            "However, two independent lines of experimental evidence contradict that assumption. First, even the weakest imaginable electrical potential drives a current through a salt solution immediately, without any threshold energy needed to break chemical bonds. Second, solutions that conduct electricity—electrolytes such as strong acids, bases, and salts—exert an anomalously large osmotic pressure and lower the freezing point of water by nearly twice the amount predicted from the number of dissolved molecules.",
            "Both puzzles are resolved at once by the theory of electrolytic dissociation: when an electrolyte such as sodium chloride dissolves in water, a large fraction—and in dilute solutions, virtually all—of its molecules spontaneously dissociate into free, electrically charged atoms or groups of atoms, which we call ions. A dilute salt solution contains twice as many independent particles as expected because each formula unit splits into a positively charged sodium ion and a negatively charged chloride ion, which move independently through the solvent and carry electrical current the instant a field is applied.",
        ],
    },

    // --- COMPUTER SCIENCE ARCHIVE ---
    ArchiveDocument {
        doc_id: "archive_cs_babbage1864",
        title: "Calculating by Steam and Eliminating Human Error",
        domain: "computer_science",
        difficulty: "Easy",
        source_attribution: "Charles Babbage, 'Passages from the Life of a Philosopher' (Chapter 5: Difference Engine No. 1, 1864)",
        sections: &[
            "One evening I was sitting in the rooms of the Analytical Society at Cambridge, my head leaning forward on the table in a kind of dreamy mood, with a table of logarithms lying open before me. Another member, coming into the room and seeing me half asleep, called out, 'Well, Babbage, what are you dreaming about?' to which I replied, 'I am thinking that all these tables,' pointing to the logarithms, 'might be calculated by machinery.'",
            "At that time, navigation at sea, astronomy, and engineering all depended on thick printed books of mathematical tables calculated by teams of human 'computers' working by hand. Despite repeated checking and proofreading, every printed volume was riddled with hundreds of human errors—mistakes made during addition, mistakes made when copying numbers from one sheet to another, and mistakes made by typesetters arranging lead type in the printing press. A single wrong digit in a navigational table could send a ship onto rocks.",
            "I realized that even the most complex mathematical tables could be computed using nothing more than repeated addition, by a method known as finite differences. If a machine built of precision brass gears and numbered wheels could perform those additions automatically and then stamp its results directly into soft metal plates for printing, human fatigue and transcription errors would be eliminated at every stage from calculation to page.",
        ],
    },
    ArchiveDocument {
        doc_id: "archive_cs_boole1854",
        title: "The Algebra of Logic: Zero and One",
        domain: "computer_science",
        difficulty: "Medium",
        source_attribution: "George Boole, 'An Investigation of the Laws of Thought' (Chapters 2 & 3, 1854)",
        sections: &[
            "The design of the following treatise is to investigate the fundamental laws of those operations of the mind by which reasoning is performed; to give expression to them in the symbolical language of a Calculus, and upon this foundation to establish the science of Logic and construct its method. For two thousand years, logic had been treated strictly as a branch of philosophy expressed in ordinary words, while algebra was regarded as the science of numerical magnitude alone.",
            "Yet it is not of the essence of mathematics to be conversant only with the ideas of number and quantity. Suppose we let a symbol such as x represent a class of things or a logical proposition, and define multiplication xy to mean selecting things that belong to both class x and class y at the same time—the logical operation 'AND.' Under this interpretation, selecting 'white sheep' and then selecting from them 'white' things again leaves us with the exact same group of 'white sheep,' giving the fundamental logical law x times x equals x.",
            "In ordinary numerical algebra, there are only two numbers in the entire universe that satisfy the equation x squared equals x: namely, 0 and 1. By assigning the symbol 0 to represent 'Nothing' (or falsehood) and the symbol 1 to represent the 'Universe' (or truth), every rule of deductive logic—conjunction, disjunction, and negation—can be reduced to a binary algebra of zeros and ones, laying the mathematical foundation for all digital logic circuits.",
        ],
    },
    ArchiveDocument {
        doc_id: "archive_cs_hopper1959",
        title: "From Machine Code to Human-Readable Compilers",
        domain: "computer_science",
        difficulty: "Hard",
        source_attribution: "Grace Murray Hopper, 'The Education of a Computer' (ACM Proceedings, 1952 & COBOL Design Notes, 1959)",
        sections: &[
            "In the earliest days of electronic computing, programming a machine required writing every single instruction in raw octal or binary machine code and manually tracking the exact physical memory address of every subroutine and variable. Whenever a programmer needed to insert a single new instruction near the beginning of a program, every subsequent memory jump and subroutine address throughout the entire program had to be recalculated by hand—a tedious process prone to constant human error.",
            "While working on the UNIVAC I, I observed that programmers were copying the same proven mathematical and data-processing subroutines from notebooks over and over again, only making mistakes when re-indexing their addresses. Clearly, the computer itself could perform that clerical work far faster and more accurately than any human. I built the A-0 system—the first compiler—which allowed a programmer to specify subroutines by symbolic call numbers so the machine could automatically look up, relocate, and assemble the required machine code into a working program.",
            "Even then, skeptics insisted that computers could only understand mathematical symbols and could never process ordinary English statements, arguing that a machine's job was to execute numbers rather than translate words. Yet once we recognize that a computer manipulates arbitrary bit patterns according to formal rules, there is no reason why engineers and business analysts should be forced to think in hexadecimal machine codes. By designing compilers like FLOW-MATIC and COBOL that translate clear, structured English verbs—such as COMPARE, TRANSFER, and SUBTRACT—into optimized machine instructions, we shift the burden of translation from the human mind to the machine.",
        ],
    },
];

/// Idempotently seeds the reading corpus with authentic texts, updating existing seed passages
/// if their text or metadata has been expanded or refined.
pub async fn seed_corpus_if_needed(db: &DbManager) -> Result<usize> {
    let conn = db
        .connect()
        .context("Failed to obtain database connection for seeding")?;
    let mut inserted_count = 0;
    let mut updated_count = 0;

    for passage in SEED_PASSAGES {
        let word_count = count_words(passage.passage_text) as i64;
        let lexical_density = calculate_lexical_density(passage.passage_text);

        // Check if passage ID already exists and whether its content needs refreshing
        let existing_record = {
            let mut existing = conn
                .query(
                    "SELECT title, source_attribution, passage_text, word_count FROM reading_corpus WHERE id = ?1",
                    [passage.id],
                )
                .await
                .context("Failed to check existing passage")?;

            if let Some(row) = existing.next().await? {
                let existing_title: String = row.get(0)?;
                let existing_attr: String = row.get(1)?;
                let existing_text: String = row.get(2)?;
                let existing_words: i64 = row.get(3)?;
                Some((existing_title, existing_attr, existing_text, existing_words))
            } else {
                None
            }
        };

        if let Some((existing_title, existing_attr, existing_text, existing_words)) = existing_record {
            if existing_title != passage.title
                || existing_attr != passage.source_attribution
                || existing_text != passage.passage_text
                || existing_words != word_count
            {
                conn.execute(
                    "UPDATE reading_corpus
                     SET title = ?2, domain = ?3, source_attribution = ?4, passage_text = ?5, word_count = ?6, lexical_density_score = ?7
                     WHERE id = ?1",
                    libsql::params![
                        passage.id,
                        passage.title,
                        passage.domain,
                        passage.source_attribution,
                        passage.passage_text,
                        word_count,
                        lexical_density
                    ],
                )
                .await
                .context("Failed to update seed passage")?;

                updated_count += 1;
            }
        } else {
            conn.execute(
                "INSERT INTO reading_corpus (id, title, domain, source_attribution, passage_text, word_count, lexical_density_score)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                libsql::params![
                    passage.id,
                    passage.title,
                    passage.domain,
                    passage.source_attribution,
                    passage.passage_text,
                    word_count,
                    lexical_density
                ],
            )
            .await
            .context("Failed to insert seed passage")?;

            inserted_count += 1;
        }
    }

    if inserted_count > 0 {
        info!("Seeded {inserted_count} authentic passages into reading_corpus");
    }
    if updated_count > 0 {
        info!("Updated {updated_count} existing seed passages in reading_corpus");
    }

    Ok(inserted_count)
}

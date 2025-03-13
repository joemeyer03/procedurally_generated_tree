# procedurally_generated_tree
## To Run
1. Download the code.
2. Start a python server. (https://realpython.com/python-http-server/#how-to-start-pythons-httpserver-in-the-command-line)
3. Open http://localhost:8000/ or wherever you created the server.
4. Click final.html

## Description
The scene includes a procedurally generated tree in a terracotta pot filled with dirt. The tree is slightly different each time as the angles between each addition (branch or leaf) are randomly generated. There are 4 total textures, the terracotta, the dirt, the leaves and the branches. There are also controls to rotate everything around the X, Y and Z axis as well as translate up, down, left, right, forward, and back. A few images are included in the repository and below. They are not extremely different from each other, but in certain instances, the angles can create wide or compact trees

<img width="330" alt="Tree2" src="https://github.com/user-attachments/assets/e4d9aed1-c389-421c-9789-df61de80bf59" />
<img width="330" alt="Tree1" src="https://github.com/user-attachments/assets/6809f0b2-184f-4a2a-8e8a-1b08328a6c3b" />

The code starts by building the pot and dirt. The pot and dirt is an edited version of an algorithm for a tessellated cone. I just had to remove the cone’s point, adjust the cone’s taper, lower the top so that it appeared inside the cone, add the textures, and then the cone became a pot.

The procedurally generated tree was added last. That required adding a grammar generator, an algorithm to process the grammar, and algorithms to draw leaves and branches. The grammar is built from a 2D fractal tree, but the angles had to be changed, and it needed to be made 3D. The final grammar used was:

- Variables:&nbsp;&nbsp;&nbsp;&nbsp;0, 1
- Constants:&nbsp;&nbsp;[, ], \\, /, +, -, .
- Axiom:&emsp;&emsp;&nbsp;&nbsp;0
- Rules:&emsp;&emsp;&nbsp;&nbsp;&nbsp;(1 ? 11.), (0 ? 1[[\0]/0][[+0]-0])

Each time the page is loaded, the grammar is run with 5 iterations, which developed a full tree that wasn’t too tall or too short. 

Once the grammar was created, it had to be processed. The constants ‘[‘ and ‘]’ are used to save the state and revert to an old state, respectively. The constants ‘+’ and ‘-’ change the x-angle and the ‘\’ and ‘/’ are necessary to change the z-angle that makes the tree 3D. Both increase or decrease the angle randomly by 25°-45°, making the tree appear more realistic and less “perfect.” Finally, the ‘.’ slightly reduces the radius of the branches.

When the parser encounters a ‘0’, it draws a leaf. A leaf is just a diamond where the top half is double the height of the bottom. The points start with the bottom corner at the origin, and then it is rotated using the current x, y and z angles and then translated to the position returned from the last branch. Of course, both sides of the leaf have to be drawn as well.

The last part of the tree is the line or branch, which it draws when it finds a ‘1’. The branch uses a cylinder tesselation algorithm, which creates the points around the origin and rotates and translates them, the same as the leaf algorithm. It then returns the new position so the next branch or leaf can be properly placed. 

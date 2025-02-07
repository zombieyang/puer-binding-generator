#include <stdio.h>
#include <map>

class Main
{
public:
    Main() {
        // single constructor should be generated
    }

    enum MainAction {
        A = 1,
        B = 2,
    };

    void print()
    {
        printf("hello world %d %d\n", MainAction::A, B);
    }

    static std::map<int, int> map;
};

int main(int argc, char* argv[]);
